import { matchBooks } from '../core/books.ts';
import { clean } from '../core/clean.ts';
import { diff } from '../core/diff.ts';
import { parseExport } from '../core/parser.ts';
import { ReadwiseClient, ReadwiseError, type BookInfo, type ReadwiseBook } from '../core/readwise.ts';
import { planSync, runSync, type SyncOutcome, type SyncProgress } from '../core/sync.ts';
import type { ExistingHighlight, ParseResult } from '../core/types.ts';
import { getRememberedBook, getToken, rememberBook, setToken } from './storage.ts';

export type Screen =
  | 'connect'
  | 'upload'
  | 'book'
  | 'bookNew'
  | 'preview'
  | 'details'
  | 'syncing'
  | 'done'
  | 'offline'
  | 'checkFailed';

export type Chosen =
  | { kind: 'existing'; book: ReadwiseBook }
  | { kind: 'new'; title: string; author: string };

export const REPO_URL = 'https://github.com/jeffrto/9wise';

function isOffline(err: unknown): boolean {
  return err instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

class App {
  screen = $state<Screen>(getToken() ? 'upload' : 'connect');
  token = $state<string | null>(getToken());
  busy = $state(false);
  error = $state<string | null>(null);
  tokenError = $state<string | null>(null);
  fileError = $state<{ name: string; message: string } | null>(null);

  fileName = $state('');
  parsed = $state.raw<ParseResult | null>(null);
  merge = $state(true);
  cleaned = $derived(this.parsed ? clean(this.parsed, { merge: this.merge }) : null);

  library = $state.raw<ReadwiseBook[] | null>(null);
  candidates = $state.raw<ReadwiseBook[]>([]);
  rememberedId = $state<number | null>(null);
  selected = $state<number | 'new'>('new');
  draft = $state({ title: '', author: '' });

  chosen = $state.raw<Chosen | null>(null);
  existing = $state.raw<ExistingHighlight[] | null>(null);
  deleteContained = $state(false);
  diff = $derived(this.cleaned && this.existing ? diff(this.cleaned.highlights, this.existing) : null);
  book = $derived<BookInfo | null>(
    !this.chosen
      ? null
      : this.chosen.kind === 'existing'
        ? { title: this.chosen.book.title, author: this.chosen.book.author }
        : { title: this.chosen.title.trim(), author: this.chosen.author.trim() || null },
  );
  plan = $derived(
    this.diff && this.book ? planSync(this.diff, this.book, { deleteContained: this.deleteContained }) : null,
  );

  progress = $state<SyncProgress | null>(null);
  waitUntil = $state<number | null>(null);
  outcome = $state.raw<SyncOutcome | null>(null);
  private retry: (() => Promise<void>) | null = null;

  private client(): ReadwiseClient {
    return new ReadwiseClient({
      token: this.token ?? '',
      onRateLimit: (ms) => (this.waitUntil = Date.now() + ms),
    });
  }

  private async run(action: () => Promise<void>, retry: () => Promise<void> = () => this.run(action)) {
    this.busy = true;
    this.error = null;
    try {
      await action();
    } catch (err) {
      if (err instanceof ReadwiseError && (err.status === 401 || err.status === 403)) {
        this.forgetToken();
        this.tokenError = 'Readwise no longer accepts your saved token. Paste it again.';
      } else if (isOffline(err)) {
        this.retry = retry;
        this.screen = 'offline';
      } else {
        this.error = message(err);
      }
    } finally {
      this.busy = false;
    }
  }

  async connect(input: string) {
    const token = input.trim();
    this.tokenError = null;
    if (!token) {
      this.tokenError = 'Paste your token first.';
      return;
    }
    this.busy = true;
    try {
      const ok = await new ReadwiseClient({ token }).checkToken();
      if (!ok) {
        this.tokenError =
          "Readwise didn't accept this token. Copy it again, making sure nothing is cut off. Nothing was saved.";
        return;
      }
      setToken(token);
      this.token = token;
      this.screen = 'upload';
    } catch (err) {
      this.tokenError = isOffline(err)
        ? "Can't reach Readwise. Check your connection and try again."
        : `Readwise had a problem checking the token (${message(err)}). Try again in a moment.`;
    } finally {
      this.busy = false;
    }
  }

  forgetToken() {
    setToken(null);
    this.token = null;
    this.tokenError = null;
    this.library = null;
    this.reset();
    this.screen = 'connect';
  }

  reset() {
    this.parsed = null;
    this.fileName = '';
    this.merge = true;
    this.chosen = null;
    this.existing = null;
    this.deleteContained = false;
    this.outcome = null;
    this.progress = null;
    this.error = null;
    this.fileError = null;
    this.screen = this.token ? 'upload' : 'connect';
  }

  async loadFile(file: File) {
    this.fileError = null;
    const parsed = parseExport(await file.text(), file.name);
    if (!parsed.blocks.length) {
      this.fileError = { name: file.name, message: 'No highlights found' };
      return;
    }
    this.reset();
    this.fileName = file.name;
    this.parsed = parsed;
    this.screen = 'book';
    await this.loadLibrary();
  }

  async loadLibrary() {
    await this.run(async () => {
      this.screen = 'book';
      this.library ??= await this.client().listBooks();
      const title = this.parsed!.bookTitle;
      const remembered = getRememberedBook(title);
      const known = remembered && this.library.find((b) => b.id === remembered.bookId);
      const matches = matchBooks(title, this.library).filter((b) => b !== known);
      this.candidates = known ? [known, ...matches.slice(0, 2)] : matches;
      this.rememberedId = known ? known.id : null;
      this.draft = { title, author: '' };
      if (this.candidates[0]) {
        this.selected = this.candidates[0].id;
      } else {
        this.selected = 'new';
        this.screen = 'bookNew';
      }
    });
  }

  async chooseBook() {
    if (this.selected === 'new') {
      this.screen = 'bookNew';
      return;
    }
    const book = this.candidates.find((b) => b.id === this.selected);
    if (!book) return;
    this.chosen = { kind: 'existing', book };
    this.deleteContained = false;
    await this.loadExisting();
  }

  confirmNewBook() {
    this.chosen = { kind: 'new', title: this.draft.title, author: this.draft.author };
    this.existing = [];
    this.showPreview();
  }

  async loadExisting() {
    const chosen = this.chosen;
    if (chosen?.kind !== 'existing') return this.showPreview();
    await this.run(async () => {
      this.existing = await this.client().exportBookHighlights(chosen.book.id);
      this.showPreview();
    });
  }

  showPreview() {
    this.screen = this.cleaned?.check.ok ? 'preview' : 'checkFailed';
  }

  setMerge(merge: boolean) {
    this.merge = merge;
    if (this.screen === 'checkFailed' || !this.cleaned?.check.ok) this.showPreview();
  }

  async tryAgain() {
    const retry = this.retry;
    this.retry = null;
    if (retry) await retry();
  }

  async sync() {
    const plan = this.plan;
    if (!plan || !this.cleaned?.check.ok) return;
    this.screen = 'syncing';
    this.progress = null;
    this.waitUntil = null;
    await this.run(
      async () => {
        try {
          this.outcome = await runSync(this.client(), plan, (p) => {
            this.progress = p;
            this.waitUntil = null;
          });
        } catch (err) {
          this.screen = 'preview';
          throw err;
        }
        const bookId = this.outcome.book?.id ?? (this.chosen?.kind === 'existing' ? this.chosen.book.id : null);
        if (bookId && this.book) {
          rememberBook(this.parsed!.bookTitle, {
            bookId,
            title: this.book.title,
            author: this.book.author ?? null,
          });
        }
        this.library = null;
        this.screen = 'done';
      },
      () => this.loadExisting(),
    );
    // A failed sync may have sent part of the changes: compare again before the next attempt.
    if ((this.screen as Screen) === 'preview' && this.chosen?.kind === 'existing') {
      const error = this.error;
      await this.loadExisting();
      this.error = error && `Sync stopped: ${error}. The preview below is up to date with Readwise.`;
    }
  }

  get readwiseUrl(): string {
    return (
      this.outcome?.book?.highlights_url ??
      (this.chosen?.kind === 'existing' ? this.chosen.book.highlights_url : null) ??
      'https://readwise.io/books'
    );
  }
}

export const app = new App();
