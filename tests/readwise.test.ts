import { describe, expect, it } from 'vitest';
import { ReadwiseClient, ReadwiseError, retryAfterMs, toNewHighlight } from '../src/core/readwise.ts';
import type { Highlight } from '../src/core/types.ts';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(responses: (Response | (() => Response))[]) {
  const calls: Call[] = [];
  const fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({
      url: String(input),
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return typeof next === 'function' ? next() : next;
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function client(responses: Parameters<typeof fakeFetch>[0], extra: { batchSize?: number } = {}) {
  const sleeps: number[] = [];
  const { fetch, calls } = fakeFetch(responses);
  const rw = new ReadwiseClient({
    token: ' secret ',
    fetch,
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  return { rw, calls, sleeps };
}

describe('checkToken', () => {
  it('accepts 204', async () => {
    const { rw, calls } = client([new Response(null, { status: 204 })]);
    expect(await rw.checkToken()).toBe(true);
    expect(calls[0]).toMatchObject({
      url: 'https://readwise.io/api/v2/auth/',
      headers: { Authorization: 'Token secret' },
    });
  });

  it('rejects 401', async () => {
    const { rw } = client([new Response('', { status: 401 })]);
    expect(await rw.checkToken()).toBe(false);
  });

  it('throws on server errors', async () => {
    const { rw } = client([new Response('', { status: 500 })]);
    await expect(rw.checkToken()).rejects.toBeInstanceOf(ReadwiseError);
  });
});

describe('listBooks', () => {
  it('follows pagination', async () => {
    const { rw, calls } = client([
      json({ next: 'https://readwise.io/api/v2/books/?page=2', results: [{ id: 1, title: 'A' }] }),
      json({ next: null, results: [{ id: 2, title: 'B' }] }),
    ]);
    const books = await rw.listBooks();
    expect(books.map((b) => b.id)).toEqual([1, 2]);
    expect(calls.map((c) => c.url)).toEqual([
      'https://readwise.io/api/v2/books/?category=books&page_size=1000',
      'https://readwise.io/api/v2/books/?page=2',
    ]);
  });
});

describe('exportBookHighlights', () => {
  it('follows pageCursor and flattens highlights', async () => {
    const { rw, calls } = client([
      json({
        nextPageCursor: 'abc',
        results: [{ user_book_id: 7, highlights: [{ id: 1, text: 'one', note: null, is_deleted: false }] }],
      }),
      json({
        nextPageCursor: null,
        results: [{ user_book_id: 7, highlights: [{ id: 2, text: 'two', note: '', is_deleted: true }] }],
      }),
    ]);
    const highlights = await rw.exportBookHighlights(7);
    expect(highlights.map((x) => x.id)).toEqual([1, 2]);
    expect(calls.map((c) => c.url)).toEqual([
      'https://readwise.io/api/v2/export/?ids=7',
      'https://readwise.io/api/v2/export/?ids=7&pageCursor=abc',
    ]);
  });
});

describe('createHighlights', () => {
  const book = { title: 'The Lighthouse Keeper', author: 'Anon', imageUrl: null };
  const highlights: Highlight[] = [1, 2, 3, 4, 5].map((id) => ({
    id,
    text: `Text ${id}`,
    note: id === 2 ? 'a note' : null,
    start: id * 60,
    end: id * 60 + 10,
    sources: [id],
  }));

  it('maps to the Readwise payload', () => {
    expect(toNewHighlight(highlights[1]!, book)).toEqual({
      text: 'Text 2',
      title: 'The Lighthouse Keeper',
      author: 'Anon',
      category: 'books',
      source_type: '9wise',
      location: 120,
      location_type: 'time_offset',
      note: 'a note',
    });
    expect(toNewHighlight(highlights[0]!, { title: 'X' })).not.toHaveProperty('note');
  });

  it('sends in batches', async () => {
    const { rw, calls } = client(
      [json([{ id: 9, title: 'T', modified_highlights: [1, 2] }]), json([{ id: 9 }]), json([{ id: 9 }])],
      { batchSize: 2 },
    );
    const result = await rw.createHighlights(highlights.map((x) => toNewHighlight(x, book)));
    expect(result).toHaveLength(3);
    expect(calls.map((c) => [c.method, (c.body as { highlights: unknown[] }).highlights.length])).toEqual([
      ['POST', 2],
      ['POST', 2],
      ['POST', 1],
    ]);
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
  });

  it('waits for Retry-After on 429 and retries', async () => {
    const { rw, calls, sleeps } = client([
      new Response('', { status: 429, headers: { 'Retry-After': '3' } }),
      json([{ id: 9 }]),
    ]);
    await rw.createHighlights([toNewHighlight(highlights[0]!, book)]);
    expect(sleeps).toEqual([3000]);
    expect(calls).toHaveLength(2);
  });

  it('gives up after too many 429s', async () => {
    const { fetch } = fakeFetch(Array.from({ length: 3 }, () => new Response('', { status: 429 })));
    const rw = new ReadwiseClient({ token: 't', fetch, sleep: async () => {}, maxRetries: 2 });
    await expect(rw.createHighlights([toNewHighlight(highlights[0]!, book)])).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe('updateHighlight', () => {
  it('sends a PATCH', async () => {
    const { rw, calls } = client([json({ id: 13, text: 'longer', note: 'n' })]);
    await rw.updateHighlight(13, { text: 'longer', note: 'n' });
    expect(calls[0]).toMatchObject({
      url: 'https://readwise.io/api/v2/highlights/13/',
      method: 'PATCH',
      body: { text: 'longer', note: 'n' },
    });
  });
});

describe('retryAfterMs', () => {
  it('reads seconds and HTTP dates', () => {
    expect(retryAfterMs('10')).toBe(10_000);
    expect(retryAfterMs('Thu, 01 Oct 2026 00:00:30 GMT', Date.parse('2026-10-01T00:00:00Z'))).toBe(30_000);
    expect(retryAfterMs(null)).toBe(60_000);
  });
});

describe('deleteHighlight', () => {
  it('sends DELETE and accepts 204 or 404', async () => {
    const { rw, calls } = client([new Response(null, { status: 204 }), new Response('', { status: 404 })]);
    await rw.deleteHighlight(5);
    await rw.deleteHighlight(6);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'DELETE https://readwise.io/api/v2/highlights/5/',
      'DELETE https://readwise.io/api/v2/highlights/6/',
    ]);
  });

  it('throws on other errors', async () => {
    const { rw } = client([new Response('', { status: 500 })]);
    await expect(rw.deleteHighlight(5)).rejects.toBeInstanceOf(ReadwiseError);
  });
});

describe('progress callbacks', () => {
  it('reports rate limits and batches', async () => {
    const { rw } = client(
      [new Response('', { status: 429, headers: { 'Retry-After': '3' } }), json([]), json([])],
      { batchSize: 1 },
    );
    const waits: number[] = [];
    const done: number[] = [];
    rw.onRateLimit = (ms) => waits.push(ms);
    const book = { title: 'T' };
    const hl = (text: string): Highlight => ({ id: 1, text, note: null, start: 0, end: 1, sources: [1] });
    await rw.createHighlights([toNewHighlight(hl('a'), book), toNewHighlight(hl('b'), book)], (n) => done.push(n));
    expect(waits).toEqual([3000]);
    expect(done).toEqual([1, 2]);
  });
});
