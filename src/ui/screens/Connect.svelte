<script lang="ts">
  import { app, REPO_URL } from '../app.svelte.ts';
  import Icon from '../Icon.svelte';

  let token = $state('');
</script>

<div class="stack" style="gap: 12px; padding-top: 8px">
  <h1 class="title hero">Your ElevenReader highlights, in Readwise.</h1>
  <p class="lead">No duplicates, no clutter. Sync the same book again whenever you add more highlights.</p>
</div>

<form
  class="card"
  style="padding: 20px; gap: 12px"
  onsubmit={(e) => {
    e.preventDefault();
    app.connect(token);
  }}
>
  <label class="field-label" for="token">Readwise access token</label>
  <input
    id="token"
    class="field"
    type="password"
    placeholder="Paste your token"
    autocomplete="off"
    spellcheck="false"
    bind:value={token}
    aria-invalid={app.tokenError ? 'true' : undefined}
    aria-describedby={app.tokenError ? 'token-error' : undefined}
  />
  {#if app.tokenError}
    <p id="token-error" class="field-error" role="alert">{app.tokenError}</p>
  {/if}
  <a class="small-link" href="https://readwise.io/access_token" target="_blank" rel="noopener">
    Get your token at readwise.io/access_token<Icon name="external" size={14} />
  </a>
  <button class="btn" type="submit" disabled={app.busy} style="margin-top: 4px">
    {#if app.busy}Checking…{:else if app.tokenError}Try again{:else}Connect{/if}
  </button>
</form>

<section class="info">
  <Icon name="lock" color="var(--ink)" />
  <p>
    <strong>Stays on your device.</strong> Your token is saved only in this browser and sent only to readwise.io.
    9wise has no server, no accounts and no analytics.
  </p>
</section>

<div class="spacer"></div>
<footer>
  <a href="{REPO_URL}#how-it-works" target="_blank" rel="noopener">How it works</a>
  <a href={REPO_URL} target="_blank" rel="noopener">Source code</a>
  <a href="{REPO_URL}#privacy" target="_blank" rel="noopener">Privacy</a>
</footer>

<style>
  .small-link {
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
  }
  .info :global(.icon) {
    flex-shrink: 0;
    margin-top: 1px;
  }
  footer {
    display: flex;
    justify-content: center;
    gap: 24px;
    font-size: 14px;
  }
</style>
