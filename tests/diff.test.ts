import { describe, expect, it } from 'vitest';
import { diff } from '../src/core/diff.ts';
import type { ExistingHighlight, Highlight } from '../src/core/types.ts';

const h = (id: number, text: string, note: string | null = null): Highlight => ({
  id,
  text,
  note,
  start: id * 10,
  end: id * 10 + 5,
  sources: [id],
});
const e = (id: number, text: string, note: string | null = null, is_deleted = false): ExistingHighlight => ({
  id,
  text,
  note,
  is_deleted,
});

const ids = (matches: { highlight: Highlight; existing: ExistingHighlight }[]) =>
  matches.map((m) => [m.highlight.id, m.existing.id]);

describe('diff', () => {
  it('marks unknown highlights as new', () => {
    const result = diff([h(1, 'Fresh text.')], [e(100, 'Something else.')]);
    expect(result.new.map((x) => x.id)).toEqual([1]);
  });

  it('treats everything as new for a new book', () => {
    expect(diff([h(1, 'A.'), h(2, 'B.')], []).new).toHaveLength(2);
  });

  it('skips identical text, ignoring quotes, spacing and case', () => {
    const result = diff([h(1, '“Same”   text.')], [e(100, '"same" text.')]);
    expect(ids(result.existing)).toEqual([[1, 100]]);
    expect(result.new).toEqual([]);
  });

  it('patches a changed note', () => {
    const result = diff([h(1, 'Text.', 'new thought')], [e(100, 'Text.', 'old thought')]);
    expect(ids(result.noteChanged)).toEqual([[1, 100]]);
  });

  it('does not touch the note when the file note is empty', () => {
    const result = diff([h(1, 'Text.', null)], [e(100, 'Text.', 'written in Readwise')]);
    expect(ids(result.existing)).toEqual([[1, 100]]);
    expect(result.noteChanged).toEqual([]);
  });

  it('does not patch a note already contained in the Readwise note', () => {
    const result = diff([h(1, 'Text.', 'thought')], [e(100, 'Text.', 'thought #tag')]);
    expect(result.noteChanged).toEqual([]);
  });

  it('patches the text when the file extends an existing highlight', () => {
    const result = diff(
      [h(1, 'The river bends twice. Children fish from the bank.')],
      [e(100, 'The river bends twice.')],
    );
    expect(ids(result.extended)).toEqual([[1, 100]]);
    expect(result.extended[0]).toMatchObject({ noteChanged: false, alsoContains: [] });
  });

  it('reports other existing highlights swallowed by the same extension', () => {
    const result = diff(
      [h(1, 'The river bends twice. Children fish from the bank.', 'n')],
      [e(100, 'The river bends twice.'), e(101, 'Children fish from the bank.')],
    );
    expect(ids(result.extended)).toEqual([[1, 101]]);
    expect(result.extended[0]!.alsoContains.map((x) => x.id)).toEqual([100]);
    expect(result.extended[0]!.noteChanged).toBe(true);
  });

  it('skips when an existing highlight contains the file text', () => {
    const result = diff([h(1, 'bends twice')], [e(100, 'The river bends twice.')]);
    expect(ids(result.existing)).toEqual([[1, 100]]);
  });

  it('ignores deleted highlights', () => {
    const result = diff([h(1, 'Text.')], [e(100, 'Text.', null, true)]);
    expect(result.new.map((x) => x.id)).toEqual([1]);
  });

  it('ignores existing highlights with empty text', () => {
    const result = diff([h(1, 'Text.')], [e(100, '')]);
    expect(result.new.map((x) => x.id)).toEqual([1]);
  });
});
