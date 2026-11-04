import { describe, expect, it } from 'vitest';
import { findBook } from '../src/core/lookup.ts';

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
