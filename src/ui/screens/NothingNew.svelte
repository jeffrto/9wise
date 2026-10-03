<script lang="ts">
  import { app } from '../app.svelte.ts';
  import { num } from '../format.ts';
  import Icon from '../Icon.svelte';

  const stats = $derived(app.cleaned!.stats);
</script>

<div class="badge-icon" style="margin-top: 24px"><Icon name="equal" size={28} color="var(--muted)" /></div>
<div class="stack">
  <h1 class="title">Already up to date</h1>
  <p class="lead">
    All {num(stats.highlights)} highlights from {app.book?.title} are already in Readwise. Nothing was sent.
  </p>
</div>
{#if stats.duplicates || stats.merged}
  <p class="info plain">
    Before comparing, 9wise removed {num(stats.duplicates)} duplicates and merged {num(stats.merged)} overlapping passages
    from the file.
  </p>
{/if}
<div class="spacer"></div>
<div class="stack">
  <button class="btn" type="button" onclick={() => app.reset()}>Sync another file</button>
  <a class="btn secondary" href={app.readwiseUrl} target="_blank" rel="noopener">
    Open in Readwise<Icon name="external" size={16} />
  </a>
  <button class="linkish" type="button" style="align-self: center" onclick={() => (app.screen = 'details')}>
    See cleanup details
  </button>
</div>
