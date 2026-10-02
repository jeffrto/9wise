import { normalize } from './normalize.ts';
import { formatTimestamp } from './parser.ts';
import {
  MAX_TEXT_LENGTH,
  type Block,
  type CleanResult,
  type Fate,
  type Highlight,
  type IntegrityCheck,
  type ParseResult,
} from './types.ts';

const FOOTNOTES = /[⁰¹²³⁴-⁹]/g;
export const MIN_OVERLAP = 20;

export interface CleanOptions {
  /** Join highlights whose time and text overlap. Default true. */
  merge?: boolean;
}

interface Group {
  text: string;
  notes: string[];
  start: number;
  end: number;
  sources: number[];
  contained: Set<number>;
}

export function stripFootnotes(text: string): string {
  return text.replace(FOOTNOTES, '');
}

function addNote(notes: string[], note: string | null): void {
  if (!note) return;
  const key = normalize(note);
  if (!notes.some((n) => normalize(n) === key)) notes.push(note);
}

/** Joins `b` onto `a` when one contains the other or the end of `a` is the start of `b`. */
export function joinTexts(a: string, b: string): { text: string; contained: boolean } | null {
  if (a.includes(b)) return { text: a, contained: true };
  if (b.includes(a)) return { text: b, contained: false };
  const head = b.slice(0, MIN_OVERLAP);
  if (head.length < MIN_OVERLAP) return null;
  for (let p = a.indexOf(head); p !== -1; p = a.indexOf(head, p + 1)) {
    const tail = a.slice(p);
    if (b.startsWith(tail)) return { text: a + b.slice(tail.length), contained: false };
  }
  return null;
}

export function clean(
  parsed: Pick<ParseResult, 'blocks' | 'warnings'>,
  options: CleanOptions = {},
): CleanResult {
  const merge = options.merge ?? true;

  const unique: { block: Block; text: string; notes: string[] }[] = [];
  const firstByKey = new Map<string, (typeof unique)[number]>();
  const duplicates: { block: number; of: number }[] = [];

  for (const block of parsed.blocks) {
    const text = stripFootnotes(block.text).trim();
    const key = normalize(text);
    const first = firstByKey.get(key);
    if (first) {
      duplicates.push({ block: block.index, of: first.block.index });
      addNote(first.notes, block.note);
      continue;
    }
    const entry = { block, text, notes: [] as string[] };
    addNote(entry.notes, block.note);
    firstByKey.set(key, entry);
    unique.push(entry);
  }

  unique.sort(
    (x, y) => x.block.start - y.block.start || x.block.end - y.block.end || x.block.index - y.block.index,
  );

  const groups: Group[] = [];
  let merges = 0;

  for (const { block, text, notes } of unique) {
    const prev = groups.at(-1);
    if (merge && prev && block.start < prev.end) {
      const joined = joinTexts(prev.text, text);
      if (joined && joined.text.length <= MAX_TEXT_LENGTH) {
        merges++;
        if (joined.contained) prev.contained.add(block.index);
        prev.text = joined.text;
        prev.end = Math.max(prev.end, block.end);
        prev.sources.push(block.index);
        notes.forEach((n) => addNote(prev.notes, n));
        continue;
      }
    }
    groups.push({
      text,
      notes: [...notes],
      start: block.start,
      end: block.end,
      sources: [block.index],
      contained: new Set(),
    });
  }

  const highlights: Highlight[] = groups.map((g, i) => ({
    id: i + 1,
    text: g.text,
    note: g.notes.length ? g.notes.join('\n\n') : null,
    start: g.start,
    end: g.end,
    sources: g.sources,
  }));

  const trace: Fate[] = [];
  const highlightOf = new Map<number, number>();
  groups.forEach((g, i) => {
    const highlight = i + 1;
    for (const block of g.sources) {
      highlightOf.set(block, highlight);
      if (g.sources.length === 1) trace.push({ kind: 'kept', block, highlight });
      else if (g.contained.has(block)) trace.push({ kind: 'contained', block, highlight });
      else trace.push({ kind: 'merged', block, highlight });
    }
  });
  for (const d of duplicates) {
    trace.push({ kind: 'duplicate', block: d.block, of: d.of, highlight: highlightOf.get(d.of)! });
  }
  for (const w of parsed.warnings) trace.push({ kind: 'ignored', block: w.index, reason: w.reason });
  trace.sort((x, y) => x.block - y.block);

  return {
    highlights,
    trace,
    stats: {
      blocks: parsed.blocks.length + parsed.warnings.length,
      ignored: parsed.warnings.length,
      duplicates: duplicates.length,
      merged: merges,
      highlights: highlights.length,
      tooLong: highlights.filter((h) => h.text.length > MAX_TEXT_LENGTH).length,
    },
    check: verifyNothingLost(parsed.blocks, highlights),
  };
}

/** Every valid block's text and note must be inside some cleaned highlight. */
export function verifyNothingLost(blocks: Block[], highlights: Highlight[]): IntegrityCheck {
  const texts = highlights.map((h) => normalize(h.text));
  const notes = highlights.map((h) => normalize(h.note));
  const missing = blocks
    .filter((b) => {
      const text = normalize(stripFootnotes(b.text));
      const note = normalize(b.note);
      return !texts.some((t, i) => t.includes(text) && (!note || notes[i]!.includes(note)));
    })
    .map((b) => b.index);
  return { ok: missing.length === 0, missing };
}

/** Cleaned highlights in the ElevenReader export format. */
export function toMarkdown(highlights: Highlight[]): string {
  return highlights
    .map(
      (h) =>
        `- **Title**: ${h.text}\n` +
        `- **Note**: ${h.note ?? 'Empty note'}\n` +
        `- **Time**: ${formatTimestamp(h.start)} - ${formatTimestamp(h.end)}\n`,
    )
    .join('\n');
}
