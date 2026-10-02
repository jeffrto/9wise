import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseExport } from '../src/core/parser.ts';
import type { Block } from '../src/core/types.ts';

export function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
}

export function parseFixture(name: string) {
  return parseExport(fixture(name), name);
}

export function blocks(...items: [string, number, number, (string | null)?][]): Block[] {
  return items.map(([text, start, end, note], i) => ({
    index: i + 1,
    line: i + 1,
    text,
    note: note ?? null,
    start,
    end,
  }));
}
