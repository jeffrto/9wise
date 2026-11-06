import { describe, expect, it } from 'vitest';
import { applyCompletions, findCompletions } from '../src/core/complete.ts';
import { verifyNothingLost } from '../src/core/clean.ts';
import type { Highlight } from '../src/core/types.ts';
import { blocks } from './helpers.ts';

const BOOK = [
  'Chapter One',
  'The keeper climbed the stairs every night. He lit the lamp, wound the clock and wrote the log. Dr. Hale never believed him.',
  'Ships passed far out at sea. The keeper wrote in his log:',
  'No light without oil, no oil without the boat.',
  'In winter the boat came twice a month. The ice kept it away for weeks at a time.',
].join('\n');

const highlights = (...texts: string[]): Highlight[] =>
  texts.map((text, i) => ({ id: i + 1, text, note: null, start: i * 10, end: i * 10 + 5, sources: [i + 1] }));

const completed = (texts: string[], book = BOOK) => {
  const hs = highlights(...texts);
  return applyCompletions(hs, findCompletions(hs, book).completions).map((h) => h.text);
};

describe('findCompletions', () => {
  it('leaves whole sentences alone', () => {
    const result = findCompletions(highlights('He lit the lamp, wound the clock and wrote the log.'), BOOK);
    expect(result).toEqual({ found: 1, notFound: [], completions: [] });
  });

  it('completes the start and the end of a cut sentence', () => {
    expect(completed(['the lamp, wound the clock'])).toEqual(['He lit the lamp, wound the clock and wrote the log.']);
  });

  it('completes a highlight that starts mid-word', () => {
    expect(completed(['eeper climbed the stairs every night.'])).toEqual([
      'The keeper climbed the stairs every night.',
    ]);
  });

  it('does not stop at abbreviations', () => {
    expect(completed(['Hale never believed him.'])).toEqual(['Dr. Hale never believed him.']);
  });

  it('adds the next paragraph after a colon', () => {
    expect(completed(['The keeper wrote in his log:'])).toEqual([
      'The keeper wrote in his log:\n\nNo light without oil, no oil without the boat.',
    ]);
  });

  it('matches text glued across paragraphs, with other quotes and spacing', () => {
    const result = findCompletions(highlights('No light without oil, no oil without the boat.In  winter the boat'), BOOK);
    expect(result.completions).toEqual([{ highlight: 1, before: '', after: ' came twice a month.' }]);
  });

  it('matches when the middle differs from the book', () => {
    const book = 'Intro. The keeper climbed the stairs every single night13 of the long winter, and he never complained once.';
    const fuzzy = findCompletions(
      highlights('The keeper climbed the stairs every single night of the long winter, and he never complained'),
      book,
    );
    expect(fuzzy.found).toBe(1);
    expect(fuzzy.completions).toEqual([{ highlight: 1, before: '', after: ' once.' }]);
  });

  it('reports highlights that are not in the book', () => {
    const result = findCompletions(highlights('He lit the lamp,', 'A sentence from another book entirely.'), BOOK);
    expect(result.found).toBe(1);
    expect(result.notFound).toEqual([2]);
  });

  it('does not extend into the next highlight', () => {
    expect(completed(['the stairs every', 'night. He lit the lamp, wound'])).toEqual([
      'The keeper climbed the stairs every',
      'night. He lit the lamp, wound the clock and wrote the log.',
    ]);
  });

  it('prefers the occurrence after the previous highlight', () => {
    const book = 'The boat came at dawn. He waited.\nLater on. The boat came at dusk, late.';
    const result = findCompletions(highlights('He waited.', 'boat came'), book);
    expect(result.completions).toEqual([{ highlight: 2, before: 'The ', after: ' at dusk, late.' }]);
  });

  it('keeps every original text inside the completed highlight', () => {
    const original = blocks(['the lamp, wound the clock', 0, 5], ['The keeper wrote in his log:', 10, 15]);
    const result = completed(original.map((b) => b.text));
    const check = verifyNothingLost(original, highlights(...result));
    expect(check.ok).toBe(true);
  });
});
