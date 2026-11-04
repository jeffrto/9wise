// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/ui/App.svelte';
import { app } from '../src/ui/app.svelte.ts';
import { fixture } from './helpers.ts';

const FILE = 'The Lighthouse Keeper - Bookmarks.md';
const BOOK = {
  id: 9,
  title: 'The Lighthouse Keeper',
  author: 'Ada Lane',
  category: 'books',
  num_highlights: 1,
  cover_image_url: null,
  highlights_url: 'https://readwise.io/bookreview/9',
};

interface Call {
  method: string;
  path: string;
  body: unknown;
}

let calls: Call[];
let routes: Record<string, () => Response>;
let component: ReturnType<typeof mount>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';
const button = (label: string) => {
  const found = [...document.querySelectorAll<HTMLElement>('button, a')].find((b) => b.textContent?.includes(label));
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found;
};
const click = (label: string) => {
  button(label).click();
  flushSync();
};
const see = (snippet: string) => vi.waitFor(() => expect(text()).toContain(snippet));

function chooseFile(name: string, content: string) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [new File([content], name)], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setWidth(width: number) {
  (window as unknown as { happyDOM: { setViewport(v: object): void } }).happyDOM.setViewport({ width, height: 844 });
}

beforeEach(() => {
  setWidth(390);
  localStorage.clear();
  app.forgetToken();
  calls = [];
  routes = {
    'GET /auth/': () => new Response(null, { status: 204 }),
    'GET /books/': () => json({ next: null, results: [BOOK] }),
    'GET /export/': () =>
      json({
        nextPageCursor: null,
        results: [
          {
            user_book_id: 9,
            highlights: [{ id: 1, text: 'Storms are only loud for those who have somewhere else to be.', note: null }],
          },
        ],
      }),
    'POST /highlights/': () => json([{ id: 9, title: BOOK.title, highlights_url: BOOK.highlights_url }]),
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const path = url.pathname.replace('/api/v2', '');
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[`${method} ${path}`];
    if (!route) throw new Error(`unexpected ${method} ${path}`);
    return route();
  });
  component = mount(App, { target: document.body });
});

afterEach(() => {
  unmount(component);
  vi.unstubAllGlobals();
});

async function connect(token = 'good-token') {
  const input = document.querySelector<HTMLInputElement>('#token')!;
  input.value = token;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  click('Connect');
}

describe('ui', () => {
  it('syncs a file to a book already in Readwise', async () => {
    expect(text()).toContain('Readwise access token');
    await connect();
    await see('Add your highlights');
    expect(localStorage.getItem('9wise.token')).toBe('good-token');

    chooseFile(FILE, fixture(FILE));
    await see('Which book is this?');
    expect(text()).toContain('Ada Lane');

    click('Continue');
    await see('What changes in Readwise');
    expect(text()).toContain('All original text is kept');
    expect(button('Sync to Readwise').textContent).toContain('4 new');

    click('Sync to Readwise');
    await see('The Lighthouse Keeper is up to date');

    const post = calls.find((c) => c.method === 'POST')!.body as { highlights: Record<string, unknown>[] };
    expect(post.highlights).toHaveLength(4);
    expect(post.highlights[0]).toMatchObject({ title: BOOK.title, author: 'Ada Lane', location: 18 });
    expect(post.highlights.map((h) => h.text).join(' ')).not.toMatch(/[¹²³]/);
    expect(button('Open in Readwise').getAttribute('href')).toBe(BOOK.highlights_url);
    expect(JSON.parse(localStorage.getItem('9wise.books')!)[BOOK.title]).toMatchObject({ bookId: 9 });
  });

  it('extends an older highlight and deletes the pieces only when confirmed', async () => {
    routes['GET /export/'] = () =>
      json({
        nextPageCursor: null,
        results: [
          {
            user_book_id: 9,
            highlights: [
              { id: 1, text: 'The lamp was lit every evening at dusk,', note: 'first' },
              { id: 2, text: 'no matter the weather.', note: 'second' },
            ],
          },
        ],
      });
    routes['PATCH /highlights/1/'] = () => json({});
    routes['DELETE /highlights/2/'] = () => new Response(null, { status: 204 });

    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Which book is this?');
    click('Continue');
    await see('1 older highlight is now inside a longer one');
    expect(button('Sync to Readwise').textContent).toContain('4 new · 1 extended');

    document.querySelector<HTMLInputElement>('.check input')!.click();
    flushSync();
    expect(button('Sync to Readwise').textContent).toContain('1 deleted');

    click('Sync to Readwise');
    await see('is up to date');
    expect(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /highlights/',
      'PATCH /highlights/1/',
      'DELETE /highlights/2/',
    ]);
    expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({
      text: 'The lamp was lit every evening at dusk, no matter the weather.',
      note: 'first\n\nsecond',
    });
  });

  it('goes back to a fresh preview when the sync fails halfway', async () => {
    routes['POST /highlights/'] = () => new Response('boom', { status: 500 });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Which book is this?');
    click('Continue');
    await see('What changes in Readwise');
    click('Sync to Readwise');
    await see('Sync stopped: Readwise 500');
    expect(text()).toContain('What changes in Readwise');
    expect(calls.filter((c) => c.path === '/export/')).toHaveLength(2);
  });

  it('rejects an invalid token without saving it', async () => {
    routes['GET /auth/'] = () => new Response('', { status: 401 });
    await connect('bad');
    await see("Readwise didn't accept this token");
    expect(localStorage.getItem('9wise.token')).toBeNull();
  });

  it('shows the cleanup details', async () => {
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Which book is this?');
    click('Continue');
    await see('What changes in Readwise');
    click('See cleanup details');
    await see('All original text is in the clean highlights');
    expect(text()).toContain('Highlight 5 · 10:33:08');
  });

  it('shows preview and details side by side on desktop', async () => {
    unmount(component);
    setWidth(1280);
    component = mount(App, { target: document.body });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Which book is this?');
    click('Continue');
    await see('What changes in Readwise');
    expect(text()).toContain('All original text is in the clean highlights');
    expect(text()).toContain('Ada Lane · synced before · from The Lighthouse Keeper - Bookmarks.md');
  });

  it('rejects a file without highlights', async () => {
    await connect();
    await see('Add your highlights');
    chooseFile('notes.txt', 'just some notes');
    await see("This isn't an ElevenReader export");
    expect(calls.some((c) => c.path === '/books/')).toBe(false);
  });

  it('asks for a title and author when the book is new', async () => {
    routes['GET /books/'] = () => json({ next: null, results: [] });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Tell us about this book');
    const author = document.querySelector<HTMLInputElement>('#author')!;
    author.value = 'Ada Lane';
    author.dispatchEvent(new Event('input', { bubbles: true }));
    click('Continue');
    await see('5 new');
    expect(calls.some((c) => c.path === '/export/')).toBe(false);
  });

  it('suggests author and cover for a new book', async () => {
    routes['GET /books/'] = () => json({ next: null, results: [] });
    routes['GET /search.json'] = () =>
      json({ docs: [{ title: 'The Lighthouse Keeper', author_name: ['Ada Lane'], cover_i: 7, first_publish_year: 1931 }] });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('1931 · Open Library');
    expect(document.querySelector<HTMLInputElement>('#author')!.value).toBe('Ada Lane');

    click('Continue');
    await see('5 new');
    expect([...document.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toContain(
      'https://covers.openlibrary.org/b/id/7-M.jpg',
    );
    click('Sync to Readwise');
    await see('is up to date');
    const post = calls.find((c) => c.method === 'POST')!.body as { highlights: Record<string, unknown>[] };
    expect(post.highlights[0]).toMatchObject({
      author: 'Ada Lane',
      image_url: 'https://covers.openlibrary.org/b/id/7-M.jpg',
    });
  });

  it('sends no cover when none of the suggestions fit', async () => {
    routes['GET /books/'] = () => json({ next: null, results: [] });
    routes['GET /search.json'] = () =>
      json({ docs: [{ title: 'The Lighthouse Keeper', author_name: ['Wrong Person'], cover_i: 8 }] });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('None of these');
    const none = [...document.querySelectorAll<HTMLInputElement>('input[name=suggestion]')].at(-1)!;
    none.click();
    flushSync();
    const author = document.querySelector<HTMLInputElement>('#author')!;
    expect(author.value).toBe('');
    author.value = 'Ada Lane';
    author.dispatchEvent(new Event('input', { bubbles: true }));
    click('Continue');
    await see('5 new');
    click('Sync to Readwise');
    await see('is up to date');
    const post = calls.find((c) => c.method === 'POST')!.body as { highlights: Record<string, unknown>[] };
    expect(post.highlights[0]).toMatchObject({ author: 'Ada Lane' });
    expect(post.highlights[0]).not.toHaveProperty('image_url');
  });

  it('finds the exact edition by ISBN', async () => {
    routes['GET /books/'] = () => json({ next: null, results: [] });
    routes['GET /search.json'] = () => json({ docs: [] });
    routes['GET /isbn/9780140449334.json'] = () =>
      json({ title: 'The Lighthouse Keeper', covers: [77], publish_date: '2006' });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Search by ISBN');
    click('Search by ISBN');
    const isbn = document.querySelector<HTMLInputElement>('#isbn')!;
    isbn.value = '978-0-14-044933-5';
    isbn.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    click('Search');
    await see("doesn't look like an ISBN");

    routes['GET /search.json'] = () =>
      json({ docs: [{ title: 'The Lighthouse Keeper', author_name: ['Ada Lane'] }] });
    isbn.value = '978-0-14-044933-4';
    isbn.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    click('Search');
    await see('2006 · Open Library');
    expect(document.querySelector<HTMLInputElement>('#author')!.value).toBe('Ada Lane');

    click('Continue');
    await see('5 new');
    click('Sync to Readwise');
    await see('is up to date');
    const post = calls.find((c) => c.method === 'POST')!.body as { highlights: Record<string, unknown>[] };
    expect(post.highlights[0]).toMatchObject({
      author: 'Ada Lane',
      image_url: 'https://covers.openlibrary.org/b/id/77-M.jpg',
    });
  });

  it('uses a pasted cover link instead of the suggested cover', async () => {
    routes['GET /books/'] = () => json({ next: null, results: [] });
    routes['GET /search.json'] = () =>
      json({ docs: [{ title: 'The Lighthouse Keeper', author_name: ['Ada Lane'], cover_i: 7 }] });
    await connect();
    await see('Add your highlights');
    chooseFile(FILE, fixture(FILE));
    await see('Cover image link');
    const cover = document.querySelector<HTMLInputElement>('#cover')!;
    const type = (value: string) => {
      cover.value = value;
      cover.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
    };

    type('http://example.com/cover.jpg');
    await see('starts with https://');
    expect(button('Continue').hasAttribute('disabled')).toBe(true);

    type('https://example.com/my-edition.jpg');
    expect(document.querySelector<HTMLImageElement>('img.cover-preview')!.src).toBe(
      'https://example.com/my-edition.jpg',
    );
    document.querySelector('img.cover-preview')!.dispatchEvent(new Event('error'));
    flushSync();
    await see("Couldn't load an image");
    expect(button('Continue').hasAttribute('disabled')).toBe(true);

    type('https://example.com/real-cover.jpg');
    expect(button('Continue').hasAttribute('disabled')).toBe(false);
    const picked = document.querySelector('input[name=suggestion]:checked')!.closest('label')!;
    expect(picked.querySelector('img')!.getAttribute('src')).toBe('https://example.com/real-cover.jpg');
    expect(picked.textContent).toContain('Cover from your link');
    click('Continue');
    await see('5 new');
    expect([...document.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toContain(
      'https://example.com/real-cover.jpg',
    );
    click('Sync to Readwise');
    await see('is up to date');
    const post = calls.find((c) => c.method === 'POST')!.body as { highlights: Record<string, unknown>[] };
    expect(post.highlights[0]).toMatchObject({
      author: 'Ada Lane',
      image_url: 'https://example.com/real-cover.jpg',
    });
  });

  it('keeps the file when Readwise is unreachable', async () => {
    await connect();
    await see('Add your highlights');
    routes['GET /books/'] = () => {
      throw new TypeError('Failed to fetch');
    };
    chooseFile(FILE, fixture(FILE));
    await see("Can't reach Readwise");
    expect(text()).toContain('5 clean highlights');

    routes['GET /books/'] = () => json({ next: null, results: [BOOK] });
    click('Try again');
    await see('Which book is this?');
  });
});
