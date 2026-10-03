<script lang="ts">
  import { app } from '../app.svelte.ts';
  import Icon from '../Icon.svelte';
  import FileCard from './FileCard.svelte';
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
    if (app.draft.title.trim()) app.confirmNewBook();
  }}
>
  <div class="stack" style="gap: 8px">
    <label class="field-label" for="title">Title</label>
    <input id="title" class="field" type="text" maxlength="511" required bind:value={app.draft.title} />
    {#if !app.parsed?.titleConfident}
      <p class="small">We couldn't read the title from the file name. Please check it.</p>
    {/if}
  </div>
  <div class="stack" style="gap: 8px">
    <label class="field-label" for="author">Author</label>
    <input id="author" class="field" type="text" maxlength="1024" bind:value={app.draft.author} />
    <p class="small">Double-check it. A different author later creates a second copy of the book in Readwise.</p>
  </div>
  <button class="btn" type="submit" disabled={!app.draft.title.trim()}>Continue</button>
</form>
