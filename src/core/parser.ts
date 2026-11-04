import type { Block, ParseResult, ParseWarning } from './types.ts';

type Field = 'title' | 'note' | 'time';

interface RawBlock {
  index: number;
  line: number;
  lines: string[];
  fields: Partial<Record<Field, string[]>>;
  current: Field | null;
}

const LABELS: Record<string, Field> = {
  title: 'title',
  título: 'title',
  titulo: 'title',
  note: 'note',
  nota: 'note',
  time: 'time',
  tempo: 'time',
};

const FIELD_LINE = /^\s*[-*]\s*\*\*([^*]+)\*\*\s*:\s?(.*)$/;
const HEADING = /^\s*#{1,6}\s/;
const EMPTY_NOTE = /^(empty note|nota vazia)$/i;

function unquote(value: string | undefined): string | undefined {
  if (value && value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).trim();
  }
  return value;
}

export function titleFromFileName(fileName: string): { title: string; confident: boolean } {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const stem = base.replace(/\.(md|markdown|txt)$/i, '').replace(/\s*\(\d+\)$/, '').trim();
  const match = stem.match(/^(.*\S)\s+-\s+bookmarks$/i);
  if (match?.[1]) return { title: match[1], confident: true };
  return { title: stem, confident: false };
}

/** Parses `mm:ss` (minutes may exceed 59) or `hh:mm:ss` into seconds. */
export function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const rest = nums.slice(1);
  if (rest.some((n) => n > 59)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseTimeRange(value: string): { start: number; end: number } | null {
  const parts = value.split(/\s*[-–—]\s*/);
  if (parts.length > 2 || !parts[0]) return null;
  const start = parseTimestamp(parts[0]);
  const end = parts[1] === undefined ? start : parseTimestamp(parts[1]);
  if (start === null || end === null) return null;
  return { start, end: Math.max(start, end) };
}

function fieldValue(lines: string[] | undefined): string | undefined {
  if (!lines) return undefined;
  return lines.join('\n').trim();
}

export function parseExport(content: string, fileName = ''): ParseResult {
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const raws: RawBlock[] = [];
  let block: RawBlock | null = null;

  const open = (line: number): RawBlock => {
    block = { index: raws.length + 1, line, lines: [], fields: {}, current: null };
    raws.push(block);
    return block;
  };

  lines.forEach((text, i) => {
    const lineNo = i + 1;
    const match = text.match(FIELD_LINE);
    const field = match ? LABELS[match[1]!.trim().toLowerCase()] : undefined;
    if (match && field) {
      const target: RawBlock =
        !block || field === 'title' || block.fields[field] ? open(lineNo) : block;
      target.fields[field] = [match[2] ?? ''];
      target.current = field;
      target.lines.push(text);
      return;
    }
    const between = !block || block.current === null || block.current === 'time';
    if (between && (text.trim() === '' || HEADING.test(text))) return;
    const target: RawBlock = !block || block.current === 'time' ? open(lineNo) : block;
    target.lines.push(text);
    if (target.current) target.fields[target.current]!.push(text);
  });

  const blocks: Block[] = [];
  const warnings: ParseWarning[] = [];

  for (const raw of raws) {
    const warn = (reason: string) =>
      warnings.push({ index: raw.index, line: raw.line, reason, raw: raw.lines.join('\n').trim() });

    const text = unquote(fieldValue(raw.fields.title));
    const note = unquote(fieldValue(raw.fields.note));
    const time = fieldValue(raw.fields.time);

    if (!raw.fields.title && !raw.fields.note && !raw.fields.time) {
      warn('unrecognized text');
      continue;
    }
    if (!text) {
      warn('missing Title');
      continue;
    }
    if (time === undefined || time === '') {
      warn('missing Time');
      continue;
    }
    const range = parseTimeRange(time);
    if (!range) {
      warn(`invalid Time "${time}"`);
      continue;
    }
    blocks.push({
      index: raw.index,
      line: raw.line,
      text,
      note: note && !EMPTY_NOTE.test(note) ? note : null,
      start: range.start,
      end: range.end,
    });
  }

  const { title, confident } = titleFromFileName(fileName);
  return { bookTitle: title, titleConfident: confident, blocks, warnings, total: raws.length };
}
