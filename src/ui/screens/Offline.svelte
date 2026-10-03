<script lang="ts">
  import { app } from '../app.svelte.ts';
  import { num } from '../format.ts';
  import Icon from '../Icon.svelte';
</script>

<div class="badge-icon" style="margin-top: 24px"><Icon name="offline" size={28} color="var(--muted)" /></div>
<div class="stack">
  <h1 class="title">Can't reach Readwise</h1>
  <p class="lead">
    {#if app.cleaned}
      Your file is ready: {num(app.cleaned.stats.highlights)} clean highlights from {app.parsed?.bookTitle}. Connect to
      the internet to compare them with your library.
    {:else}
      Check your connection and try again.
    {/if}
  </p>
</div>
<p class="info plain">
  Nothing was sent.{#if app.cleaned} The cleanup details work offline, so you can review them now.{/if}
</p>
<div class="spacer"></div>
<div class="stack">
  <button class="btn" type="button" disabled={app.busy} onclick={() => app.tryAgain()}>
    {app.busy ? 'Trying…' : 'Try again'}
  </button>
  {#if app.cleaned}
    <button class="btn secondary" type="button" onclick={() => (app.screen = 'details')}>See cleanup details</button>
  {/if}
</div>
