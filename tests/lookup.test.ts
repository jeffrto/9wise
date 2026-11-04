import { describe, expect, it } from 'vitest';
import { findBook, findByIsbn, normalizeIsbn } from '../src/core/lookup.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeFetch(handler: (url: URL) => Response) {
  const urls: URL[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url);
    return handler(url);
  }) as typeof fetch;
  return { fn, urls };
}

describe('findBook', () => {
  it('searches Open Library by title and keeps the first author', async () => {
    const { fn, urls } = fakeFetch(() =>
      json({
        docs: [
          { title: 'O Faroleiro', author_name: ['Ada Lane', 'A Translator'], cover_i: 42, first_publish_year: 1930 },
          { title: 'O Faroleiro: edição comentada', author_name: ['Someone Else'] },
        ],
      }),
    );
    expect(await findBook('O Faroleiro', { fetch: fn })).toEqual([
      { title: 'O Faroleiro', author: 'Ada Lane', year: 1930, coverUrl: 'https://covers.openlibrary.org/b/id/42-M.jpg' },
      { title: 'O Faroleiro: edição comentada', author: 'Someone Else', year: null, coverUrl: null },
    ]);
    expect(urls[0]!.hostname).toBe('openlibrary.org');
    expect(urls[0]!.searchParams.get('title')).toBe('O Faroleiro');
  });

  it('drops unrelated titles and results without an author', async () => {
    const { fn } = fakeFetch(() =>
      json({
        docs: [
          { title: 'Cozinha do Mar', author_name: ['Unrelated'] },
          { title: 'O Faroleiro' },
          { title: 'O faroleiro', author_name: ['Ada Lane'] },
        ],
      }),
    );
    expect(await findBook('O Faroleiro', { fetch: fn })).toEqual([
      { title: 'O faroleiro', author: 'Ada Lane', year: null, coverUrl: null },
    ]);
  });

  it('merges editions of the same book, filling a missing cover', async () => {
    const { fn } = fakeFetch(() =>
      json({
        docs: [
          { title: 'O Faroleiro', author_name: ['Ada Lane'], first_publish_year: 1930 },
          { title: 'O faroleiro', author_name: ['Ada Lane'], cover_i: 7 },
        ],
      }),
    );
    expect(await findBook('O Faroleiro', { fetch: fn })).toEqual([
      { title: 'O Faroleiro', author: 'Ada Lane', year: 1930, coverUrl: 'https://covers.openlibrary.org/b/id/7-M.jpg' },
    ]);
  });

  it('returns nothing instead of throwing', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(await findBook('O Faroleiro', { fetch: offline })).toEqual([]);
    expect(await findBook('O Faroleiro', { fetch: fakeFetch(() => json({}, 503)).fn })).toEqual([]);
  });
});

describe('normalizeIsbn', () => {
  it('accepts valid ISBN-10 and ISBN-13 with hyphens and spaces', () => {
    expect(normalizeIsbn('978-0-14-044933-4')).toBe('9780140449334');
    expect(normalizeIsbn('0 14 044933 7')).toBe('0140449337');
    expect(normalizeIsbn('080442957x')).toBe('080442957X');
  });

  it('rejects wrong check digits and other text', () => {
    expect(normalizeIsbn('9780140449335')).toBeNull();
    expect(normalizeIsbn('0140449338')).toBeNull();
    expect(normalizeIsbn('O Faroleiro')).toBeNull();
  });
});

describe('findByIsbn', () => {
  it('takes title, year and cover from the edition and the author from the work', async () => {
    const { fn, urls } = fakeFetch((url) =>
      url.pathname === '/isbn/9780140449334.json'
        ? json({ title: 'O Faroleiro', covers: [-1, 99], publish_date: 'March 2006' })
        : json({ docs: [{ title: 'The Lighthouse Keeper', author_name: ['Ada Lane', 'A Translator'], cover_i: 5 }] }),
    );
    expect(await findByIsbn('9780140449334', { fetch: fn })).toEqual({
      title: 'O Faroleiro',
      author: 'Ada Lane',
      year: 2006,
      coverUrl: 'https://covers.openlibrary.org/b/id/99-M.jpg',
    });
    expect(urls.find((u) => u.pathname === '/search.json')!.searchParams.get('isbn')).toBe('9780140449334');
  });

  it('falls back to the work, and to no author', async () => {
    const workOnly = fakeFetch((url) =>
      url.pathname.startsWith('/isbn/') ? json({}, 404) : json({ docs: [{ title: 'O Faroleiro', cover_i: 5 }] }),
    );
    expect(await findByIsbn('9780140449334', { fetch: workOnly.fn })).toEqual({
      title: 'O Faroleiro',
      author: '',
      year: null,
      coverUrl: 'https://covers.openlibrary.org/b/id/5-M.jpg',
    });
  });

  it('returns null for an unknown ISBN or when offline', async () => {
    const unknown = fakeFetch((url) => (url.pathname.startsWith('/isbn/') ? json({}, 404) : json({ docs: [] })));
    expect(await findByIsbn('9780140449334', { fetch: unknown.fn })).toBeNull();
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(await findByIsbn('9780140449334', { fetch: offline })).toBeNull();
  });
});
