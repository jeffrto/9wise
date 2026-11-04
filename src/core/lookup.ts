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
