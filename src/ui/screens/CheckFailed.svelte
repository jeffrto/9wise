<script lang="ts">
  import { app, REPO_URL } from '../app.svelte.ts';
  import { clock, plural } from '../format.ts';
  import Icon from '../Icon.svelte';

  const missing = $derived(
    (app.cleaned?.check.missing ?? []).map((i) => app.parsed!.blocks.find((b) => b.index === i)!),
  );
  const short = (text: string) => (text.length > 60 ? `${text.slice(0, 60).trimEnd()}…` : text);
</script>

<div class="badge-icon bad" style="width: 56px; height: 56px; margin-top: 16px">
  <Icon name="shield" size={26} />
</div>
<div class="stack">
  <h1 class="title" style="font-size: 26px">Sync stopped to protect your text</h1>
  <p style="font-size: 15px; line-height: 1.5; color: var(--ink-2)">
    {plural(missing.length, 'block')} from your file {missing.length === 1 ? "isn't" : "aren't"} in any clean highlight.
    That's a bug in 9wise, not a problem with your file. Nothing was sent to Readwise.
  </p>
</div>
<ul class="card">
  {#each missing as b (b.index)}
    <li>
      <span class="where num">#{b.index} · {clock(b.start)}</span>
      <span class="what">{short(b.text)}</span>
    </li>
  {/each}
</ul>
<div class="spacer"></div>
<div class="stack">
  {#if app.merge}
    <button class="btn tall" type="button" onclick={() => app.setMerge(false)}>
      <span>Try without merging</span>
      <span class="sub">Duplicates are still removed</span>
    </button>
  {/if}
  <a class="btn secondary" href="{REPO_URL}/issues/new" target="_blank" rel="noopener">Report the problem</a>
  <button class="linkish" type="button" style="align-self: center" onclick={() => app.reset()}>Choose another file</button>
</div>

<style>
  ul {
    list-style: none;
    padding: 6px 16px;
    gap: 0;
  }
  li {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--line-2);
    font-size: 14px;
  }
  li:last-child {
    border-bottom: none;
  }
  .where {
    color: var(--muted);
    flex-shrink: 0;
    min-width: 82px;
  }
  .what {
    font-family: var(--serif);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
