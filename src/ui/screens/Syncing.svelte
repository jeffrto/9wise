<script lang="ts">
  import type { SyncStep } from '../../core/sync.ts';
  import { app } from '../app.svelte.ts';
  import { num, plural } from '../format.ts';
  import Icon from '../Icon.svelte';

  const plan = $derived(app.plan!);
  const steps = $derived(
    (
      [
        ['create', plan.create.length, (n: number) => `Adding ${plural(n, 'new highlight')}`],
        ['extend', plan.extend.length, (n: number) => `Extending ${plural(n, 'highlight')}`],
        ['notes', plan.notes.length, (n: number) => `Updating ${plural(n, 'note')}`],
        ['delete', plan.delete.length, (n: number) => `Deleting ${plural(n, 'older highlight')}`],
      ] as [SyncStep, number, (n: number) => string][]
    ).filter(([, n]) => n > 0),
  );
  const order = $derived(steps.map(([s]) => s));
  const current = $derived(app.progress ? order.indexOf(app.progress.step) : 0);
  const total = $derived(steps.reduce((n, [, c]) => n + c, 0));
  const done = $derived(
    steps.slice(0, current).reduce((n, [, c]) => n + c, 0) + (app.progress?.done ?? 0),
  );

  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 500);
    return () => clearInterval(timer);
  });
  const wait = $derived(app.waitUntil ? Math.max(0, Math.ceil((app.waitUntil - now) / 1000)) : null);
</script>

<div class="stack" style="padding-top: 40px">
  <h1 class="title">Syncing {app.book?.title}</h1>
  <p class="lead">Keep this page open. It usually takes a few seconds.</p>
</div>

<div class="stack" style="gap: 8px">
  <div class="bar-track" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={done}>
    <div class="bar-fill" style="width: {total ? (done / total) * 100 : 0}%"></div>
  </div>
  <div class="small num">Step {Math.min(current + 2, order.length + 1)} of {order.length + 1}</div>
</div>

<ol class="card steps">
  <li>
    <span class="dot done"><Icon name="check" size={14} stroke={3} color="#fff" /></span>
    <span>Compared {plural(app.cleaned?.stats.highlights ?? 0, 'highlight')}</span>
  </li>
  {#each steps as [step, count, label], i (step)}
    {@const state = i < current ? 'done' : i === current ? 'active' : 'todo'}
    <li class={state}>
      {#if state === 'done'}
        <span class="dot done"><Icon name="check" size={14} stroke={3} color="#fff" /></span>
      {:else if state === 'active'}
        <span class="spinner" style="width: 24px; height: 24px"></span>
      {:else}
        <span class="dot todo"></span>
      {/if}
      <div class="stack" style="gap: 6px">
        <span>{label(count)}</span>
        {#if state === 'active' && app.progress && app.progress.total > 1}
          <span class="small num">{num(app.progress.done)} of {num(app.progress.total)}</span>
        {/if}
        {#if state === 'active' && wait !== null}
          <span class="small">Readwise asked us to slow down. Trying again in {wait} s.</span>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .bar-track {
    height: 8px;
    border-radius: 4px;
    background: var(--line);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--ink);
    border-radius: 4px;
    transition: width 0.3s;
  }
  .steps {
    list-style: none;
    padding: 20px;
    gap: 18px;
  }
  li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    font-size: 15px;
    line-height: 24px;
  }
  li.active {
    font-weight: 600;
  }
  li.todo {
    color: var(--muted);
  }
  li .small {
    font-weight: 400;
  }
  .dot {
    width: 24px;
    height: 24px;
    border-radius: 12px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dot.done {
    background: var(--ok);
  }
  .dot.todo {
    border: 2px solid var(--field);
  }
  .spinner {
    flex-shrink: 0;
  }
</style>
