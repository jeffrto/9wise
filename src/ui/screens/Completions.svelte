<script lang="ts">
  import { app } from '../app.svelte.ts';
  import { clock, num } from '../format.ts';
  import Icon from '../Icon.svelte';

  type Filter = 'completed' | 'notFound';
  let filter = $state<Filter>('completed');

  const result = $derived(app.completion!);
  const byId = $derived(new Map(app.cleaned!.highlights.map((h) => [h.id, h])));
  const notFound = $derived(result.notFound.map((id) => byId.get(id)!));
</script>

<button class="back" type="button" onclick={() => app.showPreview()}><Icon name="back" size={16} />Back to preview</button>

<div class="stack" style="gap: 6px">
  <h1 class="title" style="font-size: 26px">Completions</h1>
  <p class="small" style="font-size: 14px">
    Text added from the book is marked. Turn off any you'd rather send as ElevenReader exported it.
  </p>
</div>

<div class="chips">
  <button class="chip" type="button" aria-pressed={filter === 'completed'} onclick={() => (filter = 'completed')}>
    Completed · {num(result.completions.length)}
  </button>
  {#if notFound.length}
    <button class="chip" type="button" aria-pressed={filter === 'notFound'} onclick={() => (filter = 'notFound')}>
      Not in the book · {num(notFound.length)}
    </button>
  {/if}
</div>

<ol class="items">
  {#if filter === 'completed'}
    {#each result.completions as c (c.highlight)}
      {@const h = byId.get(c.highlight)!}
      {@const on = !app.skipped.has(c.highlight)}
      <li class="item" class:off={!on}>
        <div class="meta num">
          <span>Highlight {h.id} · {clock(h.start)}</span>
          <input
            class="switch"
            type="checkbox"
            role="switch"
            aria-label="Complete highlight {h.id}"
            checked={on}
            onchange={() => app.toggleCompletion(c.highlight)}
          />
        </div>
        <p class="quote text">{#if on}<mark>{c.before}</mark>{h.text}<mark>{c.after}</mark>{:else}{h.text}{/if}</p>
      </li>
    {/each}
  {:else}
    {#each notFound as h (h.id)}
      <li class="item">
        <div class="meta num"><span>Highlight {h.id} · {clock(h.start)}</span></div>
        <p class="quote text">{h.text}</p>
      </li>
    {/each}
  {/if}
</ol>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .items {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item.off .text {
    color: var(--muted);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--muted);
  }
  .text {
    white-space: pre-wrap;
  }
</style>
