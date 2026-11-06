import { DOUBLE_QUOTES, SINGLE_QUOTES } from './normalize.ts';
import { MAX_TEXT_LENGTH, type Highlight } from './types.ts';

/** Text to add around a highlight, taken from the book. */
export interface Completion {
  highlight: number;
  before: string;
  after: string;
}

export interface CompletionResult {
  /** Highlights found in the book. */
  found: number;
  /** Ids of highlights not found in the book. */
  notFound: number[];
  completions: Completion[];
}

/** Longest sentence piece added on each side. */
export const MAX_SENTENCE = 400;
/** Longest paragraph added after a highlight that ends in a colon. */
export const MAX_PARAGRAPH = 1500;

const IGNORED = /[\s­​-‍﻿⁰¹²³⁴-⁹]/;
const TERMINATOR = /[.!?…]/;
const CLOSER = /["'”’»)\]]/;
const STARTER = /[\p{Lu}\p{N}"'“‘«(\[¿¡—–-]/u;
const ABBREVIATIONS = new Set(
  'sr sra srta dr dra prof profa mr mrs ms st sto sta pe fr gen cel cap ten sgt av vol pp nº no fig ex cf'.split(' '),
);

export interface BookIndex {
  text: string;
  key: string;
  /** Position in `text` of each character of `key`. */
  pos: Int32Array;
}

const keyCache = new Map<string, string>();

/** Key text for one character: '' for characters the comparison ignores. */
function keyChar(c: string): string {
  let k = keyCache.get(c);
  if (k === undefined) {
    if (IGNORED.test(c)) k = '';
    else if (c === '…') k = '...';
    else if (/[–—‐‑]/.test(c)) k = '-';
    else k = c.replace(SINGLE_QUOTES, "'").replace(DOUBLE_QUOTES, '"').toLowerCase();
    keyCache.set(c, k);
  }
  return k;
}

/** Comparison key that ignores spacing, so text glued across paragraphs still matches. */
function keyOf(text: string): string {
  let key = '';
  for (const c of text.normalize('NFC')) key += keyChar(c);
  return key;
}

export function indexBook(book: string): BookIndex {
  const text = book.normalize('NFC');
  const key: string[] = [];
  const pos = new Int32Array(text.length * 3);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const k = keyChar(text[i]!);
    for (let j = 0; j < k.length; j++) pos[n++] = i;
    if (k) key.push(k);
  }
  return { text, key: key.join(''), pos: pos.subarray(0, n) };
}

function findFrom(key: string, part: string, from: number): number {
  const p = key.indexOf(part, from);
  return p === -1 && from > 0 ? key.indexOf(part) : p;
}

/** Where the highlight is in the book: exact match, or same start and end when the middle differs. */
function locate(book: BookIndex, hkey: string, from: number): { start: number; end: number; at: number } | null {
  const span = (a: number, b: number) => ({ start: book.pos[a]!, end: book.pos[b - 1]! + 1, at: a });
  const exact = findFrom(book.key, hkey, from);
  if (exact !== -1) return span(exact, exact + hkey.length);

  const n = Math.min(40, Math.floor(hkey.length / 3));
  if (n < 15) return null;
  const head = hkey.slice(0, n);
  const tail = hkey.slice(-n);
  const min = Math.floor(hkey.length * 0.9);
  const max = Math.ceil(hkey.length * 1.1) + 10;
  for (const start of from > 0 ? [from, 0] : [0]) {
    for (let h = book.key.indexOf(head, start); h !== -1; h = book.key.indexOf(head, h + 1)) {
      const t = book.key.indexOf(tail, h + min - n);
      if (t === -1) break;
      if (t + n - h <= max) return span(h, t + n);
    }
  }
  return null;
}

function isAbbreviation(text: string, dot: number): boolean {
  const word = text.slice(Math.max(0, dot - 12), dot).match(/(\p{L}+)$/u)?.[1];
  if (!word) return false;
  return (word.length === 1 && /\p{Lu}/u.test(word)) || ABBREVIATIONS.has(word.toLowerCase());
}

/** True when the sentence ending at `i` (a terminator) is really over. */
function endsAt(text: string, i: number): boolean {
  if (!TERMINATOR.test(text[i]!)) return false;
  if (text[i] === '.' && isAbbreviation(text, i)) return false;
  let j = i + 1;
  while (j < text.length && CLOSER.test(text[j]!)) j++;
  if (j >= text.length || text[j] === '\n') return true;
  if (!/\s/.test(text[j]!)) return false;
  while (j < text.length && text[j] === ' ') j++;
  return j >= text.length || text[j] === '\n' || STARTER.test(text[j]!);
}

/** Last non-space, non-closer character before `end`, or -1. */
function lastChar(text: string, from: number, end: number): number {
  let j = end - 1;
  while (j >= from && (/\s/.test(text[j]!) || CLOSER.test(text[j]!))) j--;
  return j;
}

function sentenceStart(text: string, start: number): number | null {
  const line = text.lastIndexOf('\n', start - 1) + 1;
  const prev = lastChar(text, line, start);
  if (prev < line || endsAt(text, prev)) return start;
  for (let k = prev; k >= line && start - k <= MAX_SENTENCE; k--) {
    if (endsAt(text, k)) {
      let s = k + 1;
      while (CLOSER.test(text[s]!) || /\s/.test(text[s]!)) s++;
      return s;
    }
  }
  return start - line <= MAX_SENTENCE ? line : null;
}

function sentenceEnd(text: string, end: number): number | null {
  const lineEnd = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end);
  const last = lastChar(text, 0, end);
  if (last >= 0 && endsAt(text, last)) return end;
  for (let k = end; k < lineEnd && k - end <= MAX_SENTENCE; k++) {
    if (endsAt(text, k)) {
      let e = k + 1;
      while (e < lineEnd && CLOSER.test(text[e]!)) e++;
      return e;
    }
  }
  return lineEnd - end <= MAX_SENTENCE ? lineEnd : null;
}

/** A highlight that ends in a colon at the end of a paragraph introduces the next one. */
function withNextParagraph(text: string, end: number): number {
  if (text[lastChar(text, 0, end)] !== ':' || (end < text.length && text[end] !== '\n')) return end;
  const next = text.indexOf('\n', end + 1);
  const nextEnd = next === -1 ? text.length : next;
  return nextEnd - end <= MAX_PARAGRAPH && nextEnd > end + 1 ? nextEnd : end;
}

const hasWords = (s: string) => /[\p{L}\p{N}]/u.test(s);

/** Finds each highlight in the book and suggests the text that completes its sentences. */
export function findCompletions(highlights: Highlight[], book: string | BookIndex): CompletionResult {
  const index = typeof book === 'string' ? indexBook(book) : book;
  const { text } = index;
  const ranges: { id: number; start: number; end: number }[] = [];
  const notFound: number[] = [];
  let from = 0;

  for (const h of highlights) {
    const hkey = keyOf(h.text);
    const found = hkey ? locate(index, hkey, from) : null;
    if (!found) {
      notFound.push(h.id);
      continue;
    }
    ranges.push({ id: h.id, start: found.start, end: found.end });
    from = found.at;
  }

  const clashes = (id: number, a: number, b: number) =>
    ranges.some((r) => r.id !== id && r.start < b && r.end > a);
  const byId = new Map(highlights.map((h) => [h.id, h]));
  const completions: Completion[] = [];

  for (const r of ranges) {
    let start = sentenceStart(text, r.start) ?? r.start;
    let end = sentenceEnd(text, r.end) ?? r.end;
    end = withNextParagraph(text, end);
    if (start < r.start && clashes(r.id, start, r.start)) start = r.start;
    if (end > r.end && clashes(r.id, r.end, end)) end = r.end;

    let before = text.slice(start, r.start);
    let after = text.slice(r.end, end).replace(/\n/g, '\n\n');
    if (!hasWords(before)) before = '';
    if (!hasWords(after)) after = '';
    if (!before && !after) continue;
    const length = before.length + byId.get(r.id)!.text.length + after.length;
    if (length > MAX_TEXT_LENGTH) continue;
    completions.push({ highlight: r.id, before, after });
  }

  return { found: ranges.length, notFound, completions };
}

export function applyCompletions(highlights: Highlight[], completions: Completion[]): Highlight[] {
  const byId = new Map(completions.map((c) => [c.highlight, c]));
  return highlights.map((h) => {
    const c = byId.get(h.id);
    return c ? { ...h, text: c.before + h.text + c.after } : h;
  });
}
