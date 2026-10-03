<script lang="ts">
  import { app } from '../app.svelte.ts';
  import { num, plural } from '../format.ts';
  import Icon from '../Icon.svelte';

  const o = $derived(app.outcome!);
  const stats = $derived(app.cleaned!.stats);
  const rows = $derived(
    (
      [
        ['Added', o.created],
        ['Extended', o.extended],
        ['Notes updated', o.notes],
        ['Older highlights deleted', o.deleted],
      ] as const
    ).filter(([label, n]) => n > 0 || label === 'Added'),
  );
</script>

<div class="badge-icon ok" style="margin-top: 32px"><Icon name="check" size={30} stroke={2.6} /></div>
<div class="stack">
  <h1 class="title">{app.book?.title} is up to date</h1>
  <p class="lead">
    {#if o.created}
      {o.created === 1 ? '1 highlight was' : `${num(o.created)} highlights were`} added to Readwise, in the order you heard
      them.
    {:else}
      Your highlights in Readwise were updated.
    {/if}
  </p>
</div>

<dl class="card num">
  {#each rows as [label, n] (label)}
    <div class="row"><dt>{label}</dt><dd>{num(n)}</dd></div>
  {/each}
  <div class="row muted"><dt>Already there, skipped</dt><dd>{num(app.diff?.existing.length ?? 0)}</dd></div>
  <div class="row muted"><dt>Duplicates and overlaps cleaned</dt><dd>{num(stats.duplicates + stats.merged)}</dd></div>
</dl>
{#if app.plan?.tooLong.length}
  <p class="small">{plural(app.plan.tooLong.length, 'highlight')} too long for Readwise {app.plan.tooLong.length === 1 ? 'was' : 'were'} left out.</p>
{/if}

<div class="spacer"></div>
<div class="stack">
  <a class="btn" href={app.readwiseUrl} target="_blank" rel="noopener">Open in Readwise<Icon name="external" size={16} /></a>
  <button class="btn secondary" type="button" onclick={() => app.reset()}>Sync another file</button>
</div>

<style>
  dl {
    padding: 6px 18px;
    gap: 0;
    font-size: 15px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--line-2);
  }
  .row:last-child {
    border-bottom: none;
  }
  .row dd {
    font-weight: 700;
  }
  .row.muted {
    color: var(--muted);
  }
  .row.muted dd {
    font-weight: 400;
  }
</style>
