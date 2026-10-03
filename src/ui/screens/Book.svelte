<script lang="ts">
  import { app } from '../app.svelte.ts';
  import Cover from '../Cover.svelte';
  import { plural } from '../format.ts';
  import Icon from '../Icon.svelte';
  import FileCard from './FileCard.svelte';
</script>

<button class="back" type="button" onclick={() => app.reset()}><Icon name="back" size={16} />Back</button>
<FileCard />

{#if !app.library}
  <div class="loading"><span class="spinner"></span>Looking for this book in your Readwise library…</div>
{:else}
  <div class="stack" style="gap: 8px">
    <h1 class="title" style="font-size: 26px">Which book is this?</h1>
    <p class="lead" style="font-size: 15px">
      {#if app.rememberedId !== null}
        You synced this file to this book before. Using it keeps every sync of this book in one place.
      {:else}
        We found a match in your Readwise library. Using it keeps every sync of this book in one place.
      {/if}
    </p>
  </div>

  <fieldset class="stack">
    <legend class="eyebrow" style="font-size: 12px; margin-bottom: 10px; padding: 0">In your Readwise library</legend>
    {#each app.candidates as book (book.id)}
      <label class="option">
        <input type="radio" name="book" value={book.id} bind:group={app.selected} />
        <Cover title={book.title} url={book.cover_image_url} />
        <div class="meta">
          <div class="book-title">{book.title}</div>
          {#if book.author}<div class="author">{book.author}</div>{/if}
          <div class="small" style="margin-top: 4px">{plural(book.num_highlights, 'highlight')} already in Readwise</div>
        </div>
      </label>
    {/each}
    <label class="option">
      <input type="radio" name="book" value="new" bind:group={app.selected} />
      <div class="new-cover"><Icon name="plus" size={18} /></div>
      <div class="meta">
        <div class="book-title">It's a different book</div>
        <div class="author">Add it to Readwise as a new book</div>
      </div>
    </label>
  </fieldset>

  <div class="spacer"></div>
  <button class="btn" type="button" disabled={app.busy} onclick={() => app.chooseBook()}>
    {app.busy ? 'Loading highlights…' : 'Continue'}
  </button>
{/if}

<style>
  fieldset {
    border: none;
    padding: 0;
  }
  .meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .book-title {
    font-size: 16px;
    font-weight: 600;
  }
  .author {
    font-size: 14px;
    color: var(--muted);
  }
  .new-cover {
    width: 48px;
    height: 70px;
    flex-shrink: 0;
    border-radius: 3px 5px 5px 3px;
    border: 1.5px dashed var(--dash);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }
</style>
