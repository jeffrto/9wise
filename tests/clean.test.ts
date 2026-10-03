import { describe, expect, it } from 'vitest';
import { clean, explainMerge, joinTexts, stripFootnotes, toMarkdown, verifyNothingLost } from '../src/core/clean.ts';
import { parseExport } from '../src/core/parser.ts';
import { MAX_TEXT_LENGTH } from '../src/core/types.ts';
import { blocks, parseFixture } from './helpers.ts';

const run = (...items: Parameters<typeof blocks>) => clean({ blocks: blocks(...items), warnings: [] });
const texts = (result: ReturnType<typeof clean>) => result.highlights.map((h) => h.text);

const A = 'The river bends twice before the old mill, and the water slows there.';
const B = 'before the old mill, and the water slows there. Children fish from the bank in summer.';
const C = 'Children fish from the bank in summer. In winter the ice keeps them away.';
const ABC =
  'The river bends twice before the old mill, and the water slows there. Children fish from the bank in summer. In winter the ice keeps them away.';

describe('footnotes', () => {
  it('removes superscript digits but keeps normal digits', () => {
    expect(stripFootnotes('heroic struggles.¹ At 4h30 he woke²³ up⁴⁵⁶⁷⁸⁹⁰')).toBe(
      'heroic struggles. At 4h30 he woke up',
    );
  });

  it('applies to the cleaned highlights', () => {
    const result = clean(parseFixture('The Lighthouse Keeper - Bookmarks.md'));
    expect(texts(result)[0]).toBe('The lamp was lit every evening at dusk, no matter the weather.');
    expect(texts(result)[1]).toContain('4h30');
    expect(texts(result).join('')).not.toMatch(/[¹²³]/);
  });
});

describe('duplicates', () => {
  it('removes consecutive duplicates keeping the first', () => {
    const result = run(['Same text.', 10, 20], ['Same text.', 10, 20], ['Other.', 30, 40]);
    expect(texts(result)).toEqual(['Same text.', 'Other.']);
    expect(result.stats.duplicates).toBe(1);
    expect(result.trace[1]).toEqual({ kind: 'duplicate', block: 2, of: 1, highlight: 1 });
  });

  it('removes non-consecutive duplicates', () => {
    const result = run(['Same text.', 10, 20], ['Other.', 30, 40], ['same  text.', 50, 60]);
    expect(texts(result)).toEqual(['Same text.', 'Other.']);
    expect(result.highlights[0]!.start).toBe(10);
  });

  it('keeps a note that only a duplicate has', () => {
    const result = run(['Same text.', 10, 20], ['Same text.', 10, 20, 'late note']);
    expect(result.highlights[0]!.note).toBe('late note');
  });
});

describe('merging', () => {
  it('drops B when contained in A', () => {
    const result = run([A, 60, 80], ['the water slows there', 70, 75]);
    expect(texts(result)).toEqual([A]);
    expect(result.trace.map((f) => f.kind)).toEqual(['merged', 'contained']);
  });

  it('keeps B when A is contained in B', () => {
    const result = run(['the water slows there', 60, 70], [A, 65, 80]);
    expect(texts(result)).toEqual([A]);
    expect(result.highlights[0]).toMatchObject({ start: 60, end: 80 });
  });

  it('joins when the end of A is the start of B', () => {
    const result = run([A, 60, 80], [B, 70, 95]);
    expect(texts(result)).toEqual([
      'The river bends twice before the old mill, and the water slows there. Children fish from the bank in summer.',
    ]);
    expect(result.highlights[0]).toMatchObject({ start: 60, end: 95, sources: [1, 2] });
  });

  it('chains three or more, comparing with the merged text', () => {
    const result = run([A, 60, 80], [B, 70, 95], [C, 90, 110]);
    expect(texts(result)).toEqual([ABC]);
    expect(result.stats.merged).toBe(2);
  });

  it('does not join when only the times overlap', () => {
    const result = run([A, 60, 80], ['Something unrelated that shares no words at all.', 70, 90]);
    expect(result.highlights).toHaveLength(2);
    expect(result.stats.merged).toBe(0);
  });

  it('does not join when the texts overlap but the times do not', () => {
    const result = run([A, 60, 80], [B, 80, 95]);
    expect(result.highlights).toHaveLength(2);
  });

  it('does not join on a tiny overlap', () => {
    expect(joinTexts('ends with the end.', 'the end. And more text follows here.')).toBeNull();
  });

  it('does not join past the Readwise limit', () => {
    const long = 'x'.repeat(MAX_TEXT_LENGTH - 10);
    const result = run([long + ' shared overlap text here', 0, 100], ['shared overlap text here and a long tail', 50, 120]);
    expect(result.highlights).toHaveLength(2);
    expect(result.stats.merged).toBe(0);
  });

  it('can be turned off', () => {
    const result = clean({ blocks: blocks([A, 60, 80], [B, 70, 95]), warnings: [] }, { merge: false });
    expect(texts(result)).toEqual([A, B]);
    expect(result.stats.merged).toBe(0);
  });

  it('sorts by start time', () => {
    const result = run(['Later.', 100, 110], ['Earlier.', 10, 20]);
    expect(texts(result)).toEqual(['Earlier.', 'Later.']);
  });

  it('concatenates notes of merged blocks', () => {
    const result = run([A, 60, 80, 'one'], [B, 70, 95, 'two']);
    expect(result.highlights[0]!.note).toBe('one\n\ntwo');
  });
});

describe('trace', () => {
  const parsed = parseFixture('chain - Bookmarks.md');
  const result = clean(parsed);

  it('produces the expected highlights', () => {
    expect(texts(result)).toEqual([
      'Intro sentence that stands alone.',
      ABC,
      'A different thought at a different time.',
    ]);
    expect(result.highlights[1]!.note).toBe('First note\n\nSecond note');
    expect(result.stats).toEqual({
      blocks: 8,
      ignored: 0,
      duplicates: 2,
      merged: 3,
      highlights: 3,
      tooLong: 0,
    });
  });

  it('points every original block to its destination', () => {
    expect(result.trace).toEqual([
      { kind: 'kept', block: 1, highlight: 1 },
      { kind: 'merged', block: 2, highlight: 2 },
      { kind: 'duplicate', block: 3, of: 2, highlight: 2 },
      { kind: 'merged', block: 4, highlight: 2 },
      { kind: 'merged', block: 5, highlight: 2 },
      { kind: 'contained', block: 6, highlight: 2 },
      { kind: 'duplicate', block: 7, of: 2, highlight: 2 },
      { kind: 'kept', block: 8, highlight: 3 },
    ]);
    expect(result.highlights[1]!.sources).toEqual([2, 4, 6, 5]);
  });

  it('includes ignored blocks', () => {
    const parsedBad = parseExport('- **Title**: Ok.\n- **Time**: 00:01 - 00:02\n\n- **Title**: No time.');
    expect(clean(parsedBad).trace).toEqual([
      { kind: 'kept', block: 1, highlight: 1 },
      { kind: 'ignored', block: 2, reason: 'missing Time' },
    ]);
  });
});

describe('nothing lost check', () => {
  const fixtures = ['The Lighthouse Keeper - Bookmarks.md', 'chain - Bookmarks.md', 'crlf - Bookmarks.md'];

  it.each(fixtures)('passes for %s', (name) => {
    const result = clean(parseFixture(name));
    expect(result.check).toEqual({ ok: true, missing: [] });
  });

  it('fails when a text is removed on purpose', () => {
    const parsed = parseFixture('chain - Bookmarks.md');
    const { highlights } = clean(parsed);
    const tampered = highlights.map((h) =>
      h.id === 2 ? { ...h, text: h.text.replace(' In winter the ice keeps them away.', '') } : h,
    );
    expect(verifyNothingLost(parsed.blocks, tampered)).toEqual({ ok: false, missing: [5] });
  });

  it('fails when a note is dropped', () => {
    const parsed = parseFixture('chain - Bookmarks.md');
    const tampered = clean(parsed).highlights.map((h) => ({ ...h, note: null }));
    expect(verifyNothingLost(parsed.blocks, tampered).missing).toEqual([4, 5]);
  });
});

describe('toMarkdown', () => {
  it.each(['The Lighthouse Keeper - Bookmarks.md', 'chain - Bookmarks.md'])(
    'round-trips %s through the parser',
    (name) => {
      const result = clean(parseFixture(name));
      const reparsed = parseExport(toMarkdown(result.highlights));
      expect(reparsed.warnings).toEqual([]);
      expect(reparsed.blocks.map(({ text, note, start, end }) => ({ text, note, start, end }))).toEqual(
        result.highlights.map(({ text, note, start, end }) => ({ text, note, start, end })),
      );
    },
  );
});

describe('explainMerge', () => {
  const marked = (segments: { text: string; added: boolean }[]) =>
    segments.map((s) => (s.added ? `[${s.text}]` : s.text)).join('');

  it('marks what each block added', () => {
    const result = explainMerge([
      'the keeper climbed the stairs every night,',
      'climbed the stairs every night, lamp in hand,',
      'lamp in hand,',
      'At dusk the keeper climbed the stairs every night, lamp in hand, and waited.',
    ]);
    expect(result.map(marked)).toEqual([
      '[the keeper climbed the stairs every night,]',
      'climbed the stairs every night,[ lamp in hand,]',
      'lamp in hand,',
      '[At dusk ]the keeper climbed the stairs every night, lamp in hand,[ and waited.]',
    ]);
  });
});
