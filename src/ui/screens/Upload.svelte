<script lang="ts">
  import { app } from '../app.svelte.ts';
  import Icon from '../Icon.svelte';

  let input: HTMLInputElement;
  let dragging = $state(false);

  function pick(files: FileList | null | undefined) {
    const file = files?.[0];
    if (file) app.loadFile(file);
  }
</script>

<div class="stack" style="padding-top: 8px">
  <h1 class="title">Add your highlights</h1>
  <p class="lead">Export a book's bookmarks from ElevenReader, then bring the file here.</p>
</div>

{#if app.fileError}
  <section class="alert" role="alert">
    <Icon name="warn" color="var(--danger)" />
    <div class="stack" style="gap: 6px">
      <div class="message-title">This isn't an ElevenReader export</div>
      <div>
        No highlights found in <strong>{app.fileError.name}</strong>. In ElevenReader, export the book's bookmarks as
        Markdown and try that file.
      </div>
    </div>
  </section>
{/if}

<section
  class="drop"
  class:dragging
  aria-label="Drop zone"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => {
    e.preventDefault();
    dragging = false;
    pick(e.dataTransfer?.files);
  }}
>
  {#if !app.fileError}
    <div class="drop-icon"><Icon name="upload" size={26} color="var(--ink)" /></div>
  {/if}
  <div class="stack" style="gap: 4px">
    <div style="font-size: 17px; font-weight: 600">Drop your .md file here</div>
    {#if !app.fileError}<div class="small" style="font-size: 14px">Like “Meditations - Bookmarks.md”</div>{/if}
  </div>
  <button class="btn" type="button" onclick={() => input.click()}>
    {app.fileError ? 'Choose another file' : 'Choose file'}
  </button>
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    accept=".md,.markdown,.txt,text/markdown,text/plain"
    tabindex="-1"
    onchange={(e) => {
      pick(e.currentTarget.files);
      e.currentTarget.value = '';
    }}
  />
</section>

{#if !app.fileError}
  <section class="card" style="padding: 16px 18px; gap: 8px">
    <h2 style="font-size: 15px; font-weight: 600">On Android? Skip the download.</h2>
    <p class="small" style="font-size: 14px; line-height: 1.5">
      Add 9wise to your home screen from the browser menu. Then export from ElevenReader and pick 9wise in the Share
      sheet.
    </p>
  </section>
{/if}

<div class="spacer"></div>
<footer>
  <span>Token saved in this browser</span>
  <span aria-hidden="true">·</span>
  <button class="linkish" type="button" onclick={() => app.forgetToken()}>Forget token</button>
</footer>

<style>
  .drop {
    border: 2px dashed var(--dash);
    border-radius: 20px;
    background: var(--surface);
    padding: 36px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .drop.dragging {
    border-color: var(--ink);
    background: var(--accent-soft);
  }
  .drop-icon {
    width: 56px;
    height: 56px;
    border-radius: 28px;
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    color: var(--muted);
  }
</style>
