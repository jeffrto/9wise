# 9wise

Send your [ElevenReader](https://elevenreader.io) highlights to [Readwise](https://readwise.io), without duplicates.

**Use it:** <https://jeffrto.github.io/9wise/>

## How to use

1. Get your Readwise access token at <https://readwise.io/access_token> and paste it into 9wise.
2. In ElevenReader, export a book's bookmarks. You get a file like `Meditations - Bookmarks.md`.
3. Drop the file into 9wise, confirm the book (for a new one, 9wise suggests the author and cover), check the
   preview and press **Sync to Readwise**.

Added more highlights to the same book later? Export again and sync the new file. Only what changed is sent.

## How it works

ElevenReader's export has a few quirks. Before anything reaches Readwise, 9wise cleans the file:

- **Exact duplicates are removed.** The export often repeats the same passage many times in a row.
- **Overlapping passages are merged.** When you highlight back-to-back passages, ElevenReader splits them into
  pieces that repeat each other. 9wise joins them into one highlight. You can turn this off in the preview.
- **Footnote markers** like `¹ ² ³` are removed from the text.
- Highlights are placed **in the order you heard them**, using their position in the audio.

Then it compares the clean highlights with what is already in Readwise for that book:

| In the file | What 9wise does |
|---|---|
| A highlight Readwise doesn't have | Adds it |
| The same highlight with a new note | Updates the note |
| A longer version of a highlight you already have | Updates the text instead of adding a copy |
| A highlight Readwise already has | Skips it |

Nothing is ever lost silently: 9wise checks that every passage from the file is inside some clean highlight and
stops if it isn't. **See cleanup details** in the preview shows where each original block went, and you can
download the clean file to check it yourself.

## Privacy

- 9wise runs entirely in your browser. There is no server, no account and no analytics.
- Your Readwise token is saved only in this browser (`localStorage`) and sent only to `readwise.io`.
  **Forget token** removes it.
- Your highlights go straight from your browser to Readwise.
- **Only for a book that isn't in your Readwise library yet**, 9wise sends its title (or the ISBN, if you search
  by ISBN) to [Open Library](https://openlibrary.org) to suggest the author and cover. No highlight text is
  sent, and you always confirm the author before syncing.

## Development

```bash
npm install
npm test        # unit and UI tests
npm run dev     # local server
npm run build   # static site in dist/
```

Built with Svelte, TypeScript and Vite. The parsing, cleanup and Readwise logic lives in `src/core/` and has no
UI dependencies.

## License

[MIT](./LICENSE)
