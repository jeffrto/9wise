<script lang="ts">
  import { app } from './app.svelte.ts';
  import Book from './screens/Book.svelte';
  import BookNew from './screens/BookNew.svelte';
  import CheckFailed from './screens/CheckFailed.svelte';
  import Connect from './screens/Connect.svelte';
  import Details from './screens/Details.svelte';
  import Done from './screens/Done.svelte';
  import Offline from './screens/Offline.svelte';
  import Preview from './screens/Preview.svelte';
  import Syncing from './screens/Syncing.svelte';
  import Upload from './screens/Upload.svelte';

  const query = window.matchMedia('(min-width: 1024px)');
  let wideScreen = $state(query.matches);
  $effect(() => {
    const update = () => (wideScreen = query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  const screen = $derived(wideScreen && app.screen === 'details' && app.diff ? 'preview' : app.screen);
  const wide = $derived(wideScreen && screen === 'preview');

  $effect(() => {
    void screen;
    window.scrollTo(0, 0);
  });

  $effect(() => {
    if (screen !== 'syncing') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
</script>

<div class="page" class:wide>
  <header>
    <div class="bar">
      <span class="logo"><span>9</span>wise</span>
      {#if app.token && screen !== 'syncing'}
        <div class="status">
          <span class="dot"></span>Readwise connected
          {#if wide}
            <button class="linkish" type="button" onclick={() => app.forgetToken()}>Forget token</button>
          {/if}
        </div>
      {/if}
    </div>
  </header>

  <main class="main">
    {#if app.error}
      <section class="alert" role="alert">
        <div class="stack" style="gap: 4px">
          <div class="message-title">Something went wrong</div>
          <div>{app.error}</div>
        </div>
        <button class="linkish" type="button" style="margin-left: auto; color: inherit" onclick={() => (app.error = null)}>
          Dismiss
        </button>
      </section>
    {/if}

    {#if screen === 'connect'}
      <Connect />
    {:else if screen === 'upload'}
      <Upload />
    {:else if screen === 'book'}
      <Book />
    {:else if screen === 'bookNew'}
      <BookNew />
    {:else if screen === 'preview' && app.plan}
      <Preview {wide} />
    {:else if screen === 'details' && app.cleaned}
      <Details />
    {:else if screen === 'syncing'}
      <Syncing />
    {:else if screen === 'done' && app.outcome}
      <Done />
    {:else if screen === 'offline'}
      <Offline />
    {:else if screen === 'checkFailed'}
      <CheckFailed />
    {:else}
      <div class="loading"><span class="spinner"></span>Loading…</div>
    {/if}
  </main>
</div>
