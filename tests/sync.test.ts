import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff.ts';
import { ReadwiseClient } from '../src/core/readwise.ts';
import { joinNotes, planSync, runSync, type SyncProgress } from '../src/core/sync.ts';
import type { ExistingHighlight, Highlight } from '../src/core/types.ts';

const h = (id: number, text: string, note: string | null = null): Highlight => ({
  id,
  text,
  note,
  start: id * 10,
  end: id * 10 + 5,
  sources: [id],
});
const e = (id: number, text: string, note: string | null = null): ExistingHighlight => ({ id, text, note });
const book = { title: 'The Lighthouse Keeper', author: 'Ada Lane' };

describe('joinNotes', () => {
  it('skips empty and repeated notes', () => {
    expect(joinNotes(null, 'One', ' ', 'one', 'Two')).toBe('One\n\nTwo');
    expect(joinNotes(null, '')).toBeNull();
  });
});

describe('planSync', () => {
  it('creates new highlights with the book info', () => {
    const plan = planSync(diff([h(1, 'Fresh text.', 'n')], []), book);
    expect(plan.create).toEqual([
      expect.objectContaining({ text: 'Fresh text.', title: book.title, author: 'Ada Lane', location: 10, note: 'n' }),
    ]);
  });

  it('replaces a changed note', () => {
    const plan = planSync(diff([h(1, 'Same.', 'New note')], [e(100, 'Same.', 'Old note')]), book);
    expect(plan.notes).toEqual([{ id: 100, patch: { note: 'New note' } }]);
  });

  it('patches the text of an extended highlight and keeps its note', () => {
    const plan = planSync(diff([h(1, 'Start of it. And more.')], [e(100, 'Start of it.', 'kept')]), book);
    expect(plan.extend).toEqual([{ id: 100, patch: { text: 'Start of it. And more.', location: 10 } }]);
    expect(plan.delete).toEqual([]);
  });

  it('leaves contained highlights alone unless confirmed', () => {
    const d = diff([h(1, 'Alpha part. Beta part.')], [e(100, 'Alpha part.', 'a'), e(101, 'Beta part.', 'b')]);
    expect(planSync(d, book).delete).toEqual([]);

    const plan = planSync(d, book, { deleteContained: true });
    expect(plan.delete).toEqual([101]);
    expect(plan.extend[0]).toEqual({
      id: 100,
      patch: { text: 'Alpha part. Beta part.', location: 10, note: 'a\n\nb' },
    });
  });

  it('leaves out highlights longer than Readwise accepts', () => {
    const plan = planSync(diff([h(1, 'x'.repeat(8192)), h(2, 'Short.')], []), book);
    expect(plan.create).toHaveLength(1);
    expect(plan.tooLong.map((x) => x.id)).toEqual([1]);
  });
});

describe('runSync', () => {
  it('creates, patches, then deletes, reporting progress', async () => {
    const calls: string[] = [];
    const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push(`${method} ${String(input).replace('https://readwise.io/api/v2', '')}`);
      if (method === 'POST') {
        return new Response(JSON.stringify([{ id: 7, title: 'T', highlights_url: 'https://readwise.io/bookreview/7' }]));
      }
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return new Response('{}');
    }) as typeof globalThis.fetch;
    const client = new ReadwiseClient({ token: 't', fetch });

    const d = diff(
      [h(1, 'Brand new.'), h(2, 'Alpha part. Beta part.'), h(3, 'Noted.', 'note')],
      [e(100, 'Alpha part.'), e(101, 'Beta part.'), e(102, 'Noted.')],
    );
    const progress: SyncProgress[] = [];
    const outcome = await runSync(client, planSync(d, book, { deleteContained: true }), (p) => progress.push(p));

    expect(calls).toEqual([
      'POST /highlights/',
      'PATCH /highlights/100/',
      'PATCH /highlights/102/',
      'DELETE /highlights/101/',
    ]);
    expect(outcome).toMatchObject({ created: 1, extended: 1, notes: 1, deleted: 1, book: { id: 7 } });
    expect(progress.at(-1)).toEqual({ step: 'delete', done: 1, total: 1 });
  });
});
