import { normalize } from './normalize.ts';
import type { ReadwiseBook } from './readwise.ts';

/** Loose key for titles: no accents, no punctuation. */
export function titleKey(title: string): string {
  return normalize(title)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function score(fileKey: string, bookKey: string): number {
  if (!fileKey || !bookKey) return 0;
  if (fileKey === bookKey) return 3;
  const [short, long] = fileKey.length < bookKey.length ? [fileKey, bookKey] : [bookKey, fileKey];
  if (short.length >= 4 && ` ${long} `.includes(` ${short} `)) return 2;
  const a = new Set(fileKey.split(' '));
  const b = new Set(bookKey.split(' '));
  const common = [...a].filter((w) => b.has(w)).length;
  return common / new Set([...a, ...b]).size >= 0.6 ? 1 : 0;
}

/** Library books that look like the file's title, best first. */
export function matchBooks(title: string, books: ReadwiseBook[], limit = 3): ReadwiseBook[] {
  const key = titleKey(title);
  return books
    .map((book) => ({ book, s: score(key, titleKey(book.title)) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || y.book.num_highlights - x.book.num_highlights)
    .slice(0, limit)
    .map((x) => x.book);
}
