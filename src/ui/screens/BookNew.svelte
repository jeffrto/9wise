<script lang="ts">
  import { app } from '../app.svelte.ts';
  import Cover from '../Cover.svelte';
  import Icon from '../Icon.svelte';
  import FileCard from './FileCard.svelte';

  let isbnOpen = $state(false);
  let isbnInput = $state('');
  const ownCover = $derived(
    app.coverLink && app.coverLink !== 'invalid' && app.brokenCover !== app.coverLink ? app.coverLink : null,
  );
</script>

<button
  class="back"
  type="button"
  onclick={() => (app.candidates.length ? (app.screen = 'book') : app.reset())}
>
  <Icon name="back" size={16} />Back
</button>
<FileCard />

<div class="stack" style="gap: 8px">
  <h1 class="title" style="font-size: 26px">Tell us about this book</h1>
  <p class="lead" style="font-size: 15px">
    Readwise groups highlights by title and author. 9wise remembers your choice for the next sync.
  </p>
</div>

<form
  class="stack"
  style="gap: 20px"
  onsubmit={(e) => {
    e.preventDefault();
    app.confirmNewBook();
  }}
>
  <div class="stack" style="gap: 8px">
    <label class="field-label" for="title">Title</label>
    <input id="title" class="field" type="text" maxlength="511" required bind:value={app.draft.title} />
    {#if !app.parsed?.titleConfident}
      <p class="small">We couldn't read the title from the file name. Please check it.</p>
    {/if}
  </div>
  {#if app.suggestions === null}
    <div class="loading"><span class="spinner"></span>Looking for the author and cover…</div>
  {:else if app.suggestions.length}
    <fieldset class="stack">
      <legend class="field-label" style="margin-bottom: 4px; padding: 0">Suggestions</legend>
      <p class="small" style="margin-bottom: 4px">Found by title on Open Library. Check the author before continuing.</p>
      {#each app.suggestions as s, i (i)}
        <label class="option">
          <input
            type="radio"
            name="suggestion"
            checked={app.suggestion === i}
            onchange={() => app.pickSuggestion(i)}
          />
          <Cover title={s.title} url={app.suggestion === i && ownCover ? ownCover : s.coverUrl} />
          <div class="meta">
            <div class="book-title">{s.title}</div>
            <div class="author">{s.author}</div>
            {#if app.suggestion === i && ownCover}
              <div class="small">Cover from your link</div>
            {/if}
            <div class="small">
              {[s.year, 'Open Library'].filter(Boolean).join(' · ')}
            </div>
          </div>
        </label>
      {/each}
      <label class="option">
        <input
          type="radio"
          name="suggestion"
          checked={app.suggestion === 'none'}
          onchange={() => app.pickSuggestion('none')}
        />
        <div class="meta">
          <div class="book-title">None of these</div>
          <div class="author">I'll type the author</div>
        </div>
      </label>
    </fieldset>
  {/if}
  {#if app.suggestions !== null}
    {#if !isbnOpen}
      <button class="inline-link" type="button" onclick={() => (isbnOpen = true)}>Search by ISBN</button>
    {:else}
      <div class="stack" style="gap: 8px">
        <label class="field-label" for="isbn">ISBN</label>
        <div class="isbn-row">
          <input
            id="isbn"
            class="field"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="978-…"
            bind:value={isbnInput}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                app.searchIsbn(isbnInput);
              }
            }}
          />
          <button
            class="btn secondary"
            type="button"
            disabled={app.isbn === 'searching' || !isbnInput.trim()}
            onclick={() => app.searchIsbn(isbnInput)}
          >
            {app.isbn === 'searching' ? 'Searching…' : 'Search'}
          </button>
        </div>
        {#if app.isbn === 'invalid'}
          <p class="small">That doesn't look like an ISBN. Check the digits on the book's copyright page.</p>
        {:else if app.isbn === 'notFound'}
          <p class="small">Open Library doesn't know this ISBN. Type the author below.</p>
        {:else}
          <p class="small">Finds the exact edition, with its cover. 10 or 13 digits.</p>
        {/if}
      </div>
    {/if}
  {/if}

  <div class="stack" style="gap: 8px">
    <label class="field-label" for="author">Author</label>
    <input id="author" class="field" type="text" maxlength="1024" bind:value={app.draft.author} />
    <p class="small">Double-check it. A different author later creates a second copy of the book in Readwise.</p>
  </div>
  <div class="stack" style="gap: 8px">
    <label class="field-label" for="cover">Cover image link <span class="optional">(optional)</span></label>
    <div class="cover-row">
      {#if app.newCover && app.brokenCover !== app.newCover}
        <img
          class="cover-preview"
          src={app.newCover}
          alt=""
          referrerpolicy="no-referrer"
          onerror={(e) => (app.brokenCover = (e.currentTarget as HTMLImageElement).getAttribute('src'))}
        />
      {:else}
        <div class="cover-preview placeholder" aria-hidden="true">{app.draft.title}</div>
      {/if}
      <input
        id="cover"
        class="field"
        type="url"
        inputmode="url"
        autocomplete="off"
        placeholder="https://…"
        bind:value={app.draft.cover}
      />
    </div>
    {#if app.coverLink === 'invalid'}
      <p class="small error-text">Use an image link that starts with https://.</p>
    {:else if app.coverLink && app.brokenCover === app.coverLink}
      <p class="small error-text">
        Couldn't load an image from this link. Copy the image address (long-press or right-click the cover), not the
        page address.
      </p>
    {:else}
      <p class="small">Not your edition's cover? Paste the image address from the publisher or a store.</p>
    {/if}
  </div>

  <button class="btn" type="submit" disabled={!app.canConfirmNewBook}>Continue</button>
</form>

<style>
  fieldset {
    border: none;
    padding: 0;
    gap: 10px;
  }
  .meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .book-title {
    font-size: 15px;
    font-weight: 600;
  }
  .author {
    font-size: 14px;
    color: var(--muted);
  }
  .error-text {
    color: var(--danger);
  }
  .optional {
    font-weight: 400;
    color: var(--muted);
  }
  .cover-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .cover-row .field {
    flex: 1;
    min-width: 0;
  }
  .cover-preview {
    width: 48px;
    height: 70px;
    flex-shrink: 0;
    border-radius: 3px 5px 5px 3px;
    object-fit: cover;
    background: #33443a;
  }
  .cover-preview.placeholder {
    color: #efe6cc;
    font-family: var(--serif);
    font-size: 9px;
    line-height: 1.15;
    display: flex;
    align-items: flex-end;
    padding: 5px;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .isbn-row {
    display: flex;
    gap: 8px;
  }
  .isbn-row .field {
    flex: 1;
    min-width: 0;
  }
  .isbn-row .btn {
    width: auto;
    flex-shrink: 0;
    padding: 0 18px;
  }
</style>
