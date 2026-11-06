<script lang="ts">
  import { app } from '../app.svelte.ts';
  import { num } from '../format.ts';
  import Icon from '../Icon.svelte';

  let input: HTMLInputElement;

  const result = $derived(app.completion);
  const total = $derived(app.cleaned?.highlights.length ?? 0);
  const active = $derived(result ? result.completions.filter((c) => !app.skipped.has(c.highlight)).length : 0);
  const error = $derived(typeof app.epubState === 'object' ? app.epubState.error : null);
</script>

<section class="card">
  <h2 class="eyebrow">Complete with the book</h2>

  {#if app.epub && result}
    <div class="stack num" style="font-size: 15px">
      <div class="row"><span>Found in the book</span><span>{num(result.found)} of {num(total)}</span></div>
      <div class="row total"><span>Completed</span><span>{num(active)}</span></div>
    </div>
    {#if result.found * 2 < total}
      <div class="warn">
        <Icon name="warn" color="#7A4F00" />
        <div>Most highlights aren't in this EPUB. Is it the same book?</div>
      </div>
    {/if}
    {#if result.completions.length}
      <button class="inline-link" type="button" onclick={() => (app.screen = 'completions')}>
        Review completions<Icon name="forward" size={16} />
      </button>
    {:else}
      <p class="small">Every highlight found already starts and ends with a full sentence.</p>
    {/if}
    <div class="file">
      <span class="name">{app.epub.name}</span>
      <button class="linkish" type="button" onclick={() => app.removeEpub()}>Remove</button>
    </div>
  {:else}
    <p class="small" style="font-size: 14px; line-height: 1.5">
      Highlights cut mid-sentence are hard to read later. Add the book's EPUB and 9wise fills in the rest of the
      sentence. The book stays in this browser.
    </p>
    {#if error}
      <div class="alert" role="alert">
        <Icon name="warn" color="var(--danger)" />
        <div>{error}</div>
      </div>
    {/if}
    <button
      class="btn secondary small"
      type="button"
      disabled={app.epubState === 'reading'}
      onclick={() => input.click()}
    >
      {#if app.epubState === 'reading'}
        <span class="spinner"></span>Reading the book…
      {:else}
        <Icon name="file" size={16} />{error ? 'Choose another EPUB' : 'Add EPUB'}
      {/if}
    </button>
  {/if}
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    accept=".epub,application/epub+zip"
    tabindex="-1"
    onchange={(e) => {
      const file = e.currentTarget.files?.[0];
      if (file) app.loadEpub(file);
      e.currentTarget.value = '';
    }}
  />
</section>

<style>
  .row {
    display: flex;
    justify-content: space-between;
  }
  .row.total {
    font-weight: 700;
    font-size: 17px;
  }
  .file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 14px;
    color: var(--muted);
  }
  .name {
    overflow-wrap: anywhere;
  }
  .file .linkish {
    padding: 4px;
  }
</style>
