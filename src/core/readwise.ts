import type { ExistingHighlight, Highlight } from './types.ts';

export const READWISE_API = 'https://readwise.io/api/v2';
export const SOURCE_TYPE = '9wise';

export interface ReadwiseBook {
  id: number;
  title: string;
  author: string | null;
  category: string;
  num_highlights: number;
  cover_image_url: string | null;
  highlights_url: string;
}

export interface BookInfo {
  title: string;
  author?: string | null;
  imageUrl?: string | null;
}

export interface NewHighlight {
  text: string;
  title: string;
  author?: string;
  image_url?: string;
  category: 'books';
  source_type: string;
  location: number;
  location_type: 'time_offset';
  note?: string;
}

export interface CreatedBook {
  id: number;
  title: string;
  highlights_url?: string;
  modified_highlights?: number[];
}

export interface HighlightPatch {
  text?: string;
  note?: string;
  location?: number;
}

export class ReadwiseError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReadwiseError';
    this.status = status;
  }
}

export interface ReadwiseClientOptions {
  token: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
  maxRetries?: number;
  batchSize?: number;
  /** Called before waiting on a 429, with the wait in milliseconds. */
  onRateLimit?: (ms: number) => void;
}

export function toNewHighlight(h: Highlight, book: BookInfo): NewHighlight {
  return {
    text: h.text,
    title: book.title,
    ...(book.author ? { author: book.author } : {}),
    ...(book.imageUrl ? { image_url: book.imageUrl } : {}),
    category: 'books',
    source_type: SOURCE_TYPE,
    location: h.start,
    location_type: 'time_offset',
    ...(h.note ? { note: h.note } : {}),
  };
}

/** Milliseconds to wait from a `Retry-After` header (seconds or HTTP date). */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }
  return 60_000;
}

export class ReadwiseClient {
  private readonly token: string;
  private readonly fetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly batchSize: number;
  onRateLimit?: (ms: number) => void;

  constructor(options: ReadwiseClientOptions) {
    this.token = options.token.trim();
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.baseUrl = options.baseUrl ?? READWISE_API;
    this.maxRetries = options.maxRetries ?? 5;
    this.batchSize = options.batchSize ?? 100;
    this.onRateLimit = options.onRateLimit;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { Authorization: `Token ${this.token}` };
    if (init.body) headers['Content-Type'] = 'application/json';

    for (let attempt = 0; ; attempt++) {
      const res = await this.fetch(url, { ...init, headers });
      if (res.status === 429 && attempt < this.maxRetries) {
        const wait = retryAfterMs(res.headers.get('Retry-After'));
        this.onRateLimit?.(wait);
        await this.sleep(wait);
        continue;
      }
      return res;
    }
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ReadwiseError(res.status, `Readwise ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  /** True for a valid token, false for 401/403. */
  async checkToken(): Promise<boolean> {
    const res = await this.request('/auth/');
    if (res.status === 204 || res.status === 200) return true;
    if (res.status === 401 || res.status === 403) return false;
    throw new ReadwiseError(res.status, `Readwise ${res.status} on token check`);
  }

  async listBooks(category = 'books'): Promise<ReadwiseBook[]> {
    const books: ReadwiseBook[] = [];
    let next: string | null = `/books/?category=${encodeURIComponent(category)}&page_size=1000`;
    while (next) {
      const page: { next: string | null; results: ReadwiseBook[] } = await this.json(next);
      books.push(...page.results);
      next = page.next;
    }
    return books;
  }

  async exportBookHighlights(bookId: number): Promise<ExistingHighlight[]> {
    const highlights: ExistingHighlight[] = [];
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ ids: String(bookId) });
      if (cursor) params.set('pageCursor', cursor);
      const page: {
        nextPageCursor: string | null;
        results: { user_book_id: number; highlights: ExistingHighlight[] }[];
      } = await this.json(`/export/?${params}`);
      for (const book of page.results) {
        if (book.user_book_id === bookId) highlights.push(...book.highlights);
      }
      cursor = page.nextPageCursor;
    } while (cursor);
    return highlights;
  }

  async createHighlights(
    highlights: NewHighlight[],
    onBatch?: (done: number) => void,
  ): Promise<CreatedBook[]> {
    const books: CreatedBook[] = [];
    for (let i = 0; i < highlights.length; i += this.batchSize) {
      const batch = highlights.slice(i, i + this.batchSize);
      const created: CreatedBook[] = await this.json('/highlights/', {
        method: 'POST',
        body: JSON.stringify({ highlights: batch }),
      });
      books.push(...created);
      onBatch?.(i + batch.length);
    }
    return books;
  }

  async updateHighlight(id: number, patch: HighlightPatch): Promise<ExistingHighlight> {
    return this.json(`/highlights/${id}/`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  async deleteHighlight(id: number): Promise<void> {
    const res = await this.request(`/highlights/${id}/`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new ReadwiseError(res.status, `Readwise ${res.status} deleting highlight ${id}`);
    }
  }
}
