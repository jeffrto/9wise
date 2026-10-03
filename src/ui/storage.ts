const TOKEN_KEY = '9wise.token';
const BOOKS_KEY = '9wise.books';

export interface RememberedBook {
  bookId: number;
  title: string;
  author: string | null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the app still works for this session.
  }
}

export const getToken = () => read(TOKEN_KEY);
export const setToken = (token: string | null) => write(TOKEN_KEY, token);

function books(): Record<string, RememberedBook> {
  try {
    return JSON.parse(read(BOOKS_KEY) ?? '{}') as Record<string, RememberedBook>;
  } catch {
    return {};
  }
}

/** Book chosen last time for a file title, keyed by the ElevenReader title. */
export const getRememberedBook = (fileTitle: string): RememberedBook | null => books()[fileTitle] ?? null;

export function rememberBook(fileTitle: string, book: RememberedBook): void {
  write(BOOKS_KEY, JSON.stringify({ ...books(), [fileTitle]: book }));
}
