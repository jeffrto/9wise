import { score, titleKey } from './books.ts';

export interface BookSuggestion {
  title: string;
  author: string;
  year: number | null;
  coverUrl: string | null;
}

export interface LookupOptions {
  fetch?: typeof fetch;
  limit?: number;
}

const OPEN_LIBRARY = 'https://openlibrary.org/search.json';

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
}

/** Author and cover candidates from Open Library for a book that isn't in Readwise yet. Never throws. */
export async function findBook(title: string, options: LookupOptions = {}): Promise<BookSuggestion[]> {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const params = new URLSearchParams({
    title,
    limit: '10',
    fields: 'title,author_name,cover_i,first_publish_year',
  });
  let docs: OpenLibraryDoc[];
  try {
    const res = await fetchFn(`${OPEN_LIBRARY}?${params}`);
    if (!res.ok) return [];
    docs = ((await res.json()) as { docs?: OpenLibraryDoc[] }).docs ?? [];
  } catch {
    return [];
  }

  const fileKey = titleKey(title);
  const seen = new Map<string, BookSuggestion>();
  for (const d of docs) {
    // Open Library lists translators and editors as authors; the first one is the author.
    const author = d.author_name?.[0];
    if (!d.title || !author || score(fileKey, titleKey(d.title)) === 0) continue;
    const coverUrl = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null;
    const key = `${titleKey(d.title)}|${titleKey(author)}`;
    const prev = seen.get(key);
    if (prev) prev.coverUrl ??= coverUrl;
    else seen.set(key, { title: d.title, author, year: d.first_publish_year ?? null, coverUrl });
  }
  return [...seen.values()].slice(0, options.limit ?? 3);
}

/** Digits of a valid ISBN-10 or ISBN-13 (hyphens and spaces allowed), or null. */
export function normalizeIsbn(input: string): string | null {
  const isbn = input.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? isbn : null;
  }
  if (/^\d{13}$/.test(isbn)) {
    const sum = [...isbn].reduce((acc, c, i) => acc + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? isbn : null;
  }
  return null;
}

interface OpenLibraryEdition {
  title?: string;
  covers?: number[];
  publish_date?: string;
}

async function getJson<T>(fetchFn: typeof fetch, url: string): Promise<T | null> {
  try {
    const res = await fetchFn(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * The exact edition for an ISBN: title, year and cover from the edition, author from its work
 * (editions often have no author). Null when Open Library doesn't know the ISBN. Never throws.
 */
export async function findByIsbn(isbn: string, options: LookupOptions = {}): Promise<BookSuggestion | null> {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const params = new URLSearchParams({ isbn, limit: '1', fields: 'title,author_name,cover_i' });
  const [edition, search] = await Promise.all([
    getJson<OpenLibraryEdition>(fetchFn, `https://openlibrary.org/isbn/${isbn}.json`),
    getJson<{ docs?: OpenLibraryDoc[] }>(fetchFn, `${OPEN_LIBRARY}?${params}`),
  ]);
  const work = search?.docs?.[0];
  const title = edition?.title ?? work?.title;
  if (!title) return null;
  const cover = edition?.covers?.find((id) => id > 0) ?? work?.cover_i;
  const year = edition?.publish_date?.match(/\d{4}/)?.[0];
  return {
    title,
    author: work?.author_name?.[0] ?? '',
    year: year ? Number(year) : null,
    coverUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : null,
  };
}
