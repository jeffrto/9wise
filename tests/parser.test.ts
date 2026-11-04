import { describe, expect, it } from 'vitest';
import { parseExport, parseTimestamp, titleFromFileName } from '../src/core/parser.ts';
import { fixture, parseFixture } from './helpers.ts';

describe('parseExport', () => {
  const parsed = parseFixture('The Lighthouse Keeper - Bookmarks.md');

  it('reads every block', () => {
    expect(parsed.blocks).toHaveLength(5);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.total).toBe(5);
    expect(parsed.bookTitle).toBe('The Lighthouse Keeper');
    expect(parsed.titleConfident).toBe(true);
  });

  it('treats "Empty note" as no note', () => {
    expect(parsed.blocks[0]!.note).toBeNull();
  });

  it('keeps a real note', () => {
    expect(parsed.blocks[1]!.note).toBe('Reminds me of my grandfather');
  });

  it('converts mm:ss to seconds', () => {
    expect(parsed.blocks[0]).toMatchObject({ start: 18, end: 56 });
  });

  it('accepts minutes past 59', () => {
    expect(parsed.blocks[3]).toMatchObject({ start: 61 * 60 + 7, end: 61 * 60 + 30 });
    expect(parsed.blocks[4]).toMatchObject({ start: 37988, end: 38020 });
  });

  it('keeps line breaks inside the text', () => {
    expect(parsed.blocks[2]!.text).toBe(
      'Ships passed in silence, trusting a light they would never thank.²\nThe keeper did not mind.³',
    );
  });

  it('handles \\r\\n', () => {
    const crlf = parseFixture('crlf - Bookmarks.md');
    expect(crlf.blocks.map((b) => b.text)).toEqual(['Windows line endings work.', 'Second block.']);
    expect(crlf.warnings).toEqual([]);
  });

  it('warns about malformed blocks and keeps the rest', () => {
    const content = [
      '- **Title**: Good one.',
      '- **Note**: Empty note',
      '- **Time**: 00:01 - 00:02',
      '',
      '- **Title**: No time here.',
      '- **Note**: Empty note',
      '',
      '- **Title**: Bad time.',
      '- **Note**: Empty note',
      '- **Time**: soon',
      '',
      '- **Note**: Orphan note',
      '- **Time**: 00:05 - 00:06',
      '',
      '- **Title**: Last good one.',
      '- **Note**: Empty note',
      '- **Time**: 00:07 - 00:08',
      'Exported by some app',
    ].join('\n');
    const result = parseExport(content);
    expect(result.blocks.map((b) => [b.index, b.text])).toEqual([
      [1, 'Good one.'],
      [5, 'Last good one.'],
    ]);
    expect(result.warnings.map((w) => [w.index, w.reason])).toEqual([
      [2, 'missing Time'],
      [3, 'invalid Time "soon"'],
      [4, 'missing Title'],
      [6, 'unrecognized text'],
    ]);
    expect(result.total).toBe(6);
  });

  it('tolerates extra spaces and a missing blank line', () => {
    const result = parseExport(
      '-   **Title**:   Spaced out.  \n- **Note**: Empty note\n- **Time**:  00:01-00:03\n- **Title**: Next.\n- **Time**: 00:04 - 00:05',
    );
    expect(result.blocks.map((b) => [b.text, b.start, b.end, b.note])).toEqual([
      ['Spaced out.', 1, 3, null],
      ['Next.', 4, 5, null],
    ]);
  });

  it('returns nothing for an empty file', () => {
    expect(parseExport('', 'x.md')).toMatchObject({ blocks: [], warnings: [], total: 0 });
    expect(parseExport('\n\n  \n')).toMatchObject({ blocks: [], warnings: [], total: 0 });
  });

  it('strips a BOM', () => {
    expect(parseExport('﻿' + fixture('crlf - Bookmarks.md')).blocks).toHaveLength(2);
  });
});

describe('titleFromFileName', () => {
  it('drops " - Bookmarks.md"', () => {
    expect(titleFromFileName('Os deuses e o homem - Bookmarks.md')).toEqual({
      title: 'Os deuses e o homem',
      confident: true,
    });
  });

  it('handles browser duplicate suffixes and paths', () => {
    expect(titleFromFileName('/tmp/Dune - Bookmarks (2).md')).toEqual({ title: 'Dune', confident: true });
  });

  it('falls back to the name without extension', () => {
    expect(titleFromFileName('my highlights.md')).toEqual({ title: 'my highlights', confident: false });
    expect(titleFromFileName('')).toEqual({ title: '', confident: false });
  });
});

describe('parseTimestamp', () => {
  it('parses mm:ss, long minutes and hh:mm:ss', () => {
    expect(parseTimestamp('04:23')).toBe(263);
    expect(parseTimestamp('634:36')).toBe(38076);
    expect(parseTimestamp('1:02:03')).toBe(3723);
  });

  it('rejects garbage', () => {
    expect(parseTimestamp('4:61')).toBeNull();
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp('12')).toBeNull();
  });
});

describe('parseExport (Portuguese export)', () => {
  const parsed = parseFixture('O Faroleiro - Bookmarks.md');

  it('reads localized labels and skips the heading', () => {
    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.total).toBe(3);
    expect(parsed.bookTitle).toBe('O Faroleiro');
  });

  it('strips the quotes around the text', () => {
    expect(parsed.blocks[0]!.text).toBe('O farol acendia antes de o sol se pôr, por teimosia.');
    expect(parsed.blocks[2]!.text).toBe('Ele dizia que o mar “não tem pressa”, e acreditava nisso.');
  });

  it('treats "Nota vazia" as no note', () => {
    expect(parsed.blocks[0]!.note).toBeNull();
    expect(parsed.blocks[1]!.note).toBe('Lembra meu avô');
  });

  it('reads h:mm:ss times', () => {
    expect(parsed.blocks[1]).toMatchObject({ start: 3599, end: 3622 });
    expect(parsed.blocks[2]).toMatchObject({ start: 4 * 3600 + 16 * 60 + 1, end: 4 * 3600 + 16 * 60 + 33 });
  });
});
