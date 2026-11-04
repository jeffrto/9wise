<script lang="ts">
  import { app } from '../app.svelte.ts';
  import Cover from '../Cover.svelte';
  import { num, plural } from '../format.ts';
  import Icon from '../Icon.svelte';
  import Details from './Details.svelte';
  import NothingNew from './NothingNew.svelte';

  let { wide = false }: { wide?: boolean } = $props();

  const stats = $derived(app.cleaned!.stats);
  const plan = $derived(app.plan!);
  const diff = $derived(app.diff!);
  const warnings = $derived(app.parsed!.warnings);
  const contained = $derived(diff.extended.filter((m) => m.alsoContains.length));
  const containedCount = $derived(contained.reduce((n, m) => n + m.alsoContains.length, 0));
  const nothing = $derived(!plan.create.length && !plan.extend.length && !plan.notes.length);
  const summary = $derived(
    [
      plan.create.length && `${num(plan.create.length)} new`,
      plan.extend.length && `${num(plan.extend.length)} extended`,
      plan.notes.length && plural(plan.notes.length, 'note'),
      plan.delete.length && `${num(plan.delete.length)} deleted`,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  const cover = $derived(
    app.chosen?.kind === 'existing' ? app.chosen.book.cover_image_url : (app.chosen?.imageUrl ?? null),
  );

  const byline = $derived(
    [app.book!.author ?? 'No author', app.existing?.length && 'synced before', wide && `from ${app.fileName}`]
      .filter(Boolean)
      .join(' · '),
  );

  const short = (text: string, max = 110) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
  const back = () => (app.screen = app.chosen?.kind === 'new' ? 'bookNew' : 'book');
</script>

{#if nothing}
  <NothingNew />
{:else}
  {#if !wide}
    <button class="back" type="button" onclick={back}><Icon name="back" size={16} />Back</button>
  {/if}

  <div class="book-head">
    <Cover title={app.book!.title} url={cover} size={wide ? 'md' : 'sm'} />
    <div style="flex: 1 1 200px; min-width: 0">
      <h1 class="book-title">{app.book!.title}</h1>
      <div class="author">{byline}</div>
    </div>
    {#if wide}
      <div style="display: flex; gap: 10px">
        <button class="btn secondary small" type="button" onclick={back}>Change book</button>
        <button class="btn secondary small" type="button" onclick={() => app.reset()}>Replace file</button>
      </div>
    {:else}
      <button class="linkish" type="button" style="font-size: 14px" onclick={back}>Change</button>
    {/if}
  </div>

  <div class="columns" class:wide>
    <div class="side">
      <section class="card">
        <h2 class="eyebrow">Cleaning up the file</h2>
        <div class="stack num" style="font-size: 15px">
          <div class="row"><span>Blocks in the file</span><span>{num(stats.blocks)}</span></div>
          {#if stats.ignored}
            <div class="row muted"><span>Couldn't be read</span><span>−{num(stats.ignored)}</span></div>
          {/if}
          <div class="row muted"><span>Exact duplicates removed</span><span>−{num(stats.duplicates)}</span></div>
          <div class="row muted"><span>Overlapping passages merged</span><span>−{num(stats.merged)}</span></div>
          <div class="rule"></div>
          <div class="row total"><span>Clean highlights</span><span>{num(stats.highlights)}</span></div>
        </div>
        <div class="seal"><Icon name="check" size={18} stroke={2.4} />All original text is kept</div>
        <div class="merge">
          <label for="merge" class="stack" style="flex: 1; gap: 3px; cursor: pointer">
            <span style="font-size: 15px; font-weight: 600">Merge overlapping passages</span>
            <span class="small">ElevenReader splits back-to-back highlights into pieces that repeat each other.</span>
          </label>
          <input
            id="merge"
            class="switch"
            type="checkbox"
            role="switch"
            checked={app.merge}
            onchange={(e) => app.setMerge(e.currentTarget.checked)}
          />
        </div>
        {#if !wide}
          <button class="inline-link" type="button" onclick={() => (app.screen = 'details')}>
            See cleanup details<Icon name="forward" size={16} />
          </button>
        {/if}
      </section>

      <section class="card">
        <h2 class="eyebrow">What changes in Readwise</h2>
        <div class="change">
          <div class="change-icon accent"><Icon name="plus" size={18} stroke={2.2} color="var(--ink)" /></div>
          <div style="flex: 1">
            <div class="change-title">New highlights</div>
            <div class="small">Added in the order you heard them</div>
          </div>
          <div class="count">{num(plan.create.length)}</div>
        </div>
        {#if plan.extend.length}
          <div class="change" style="align-items: flex-start">
            <div class="change-icon accent"><Icon name="extend" size={18} color="var(--ink)" /></div>
            <div style="flex: 1">
              <div class="change-title">Extended</div>
              <div class="small">You highlighted more of a passage you already had. It's updated instead of copied.</div>
            </div>
            <div class="count">{num(plan.extend.length)}</div>
          </div>
        {/if}
        {#if plan.notes.length}
          <div class="change">
            <div class="change-icon"><Icon name="pencil" size={18} color="var(--ink)" /></div>
            <div style="flex: 1">
              <div class="change-title">Notes to update</div>
              <div class="small">Your notes from ElevenReader</div>
            </div>
            <div class="count">{num(plan.notes.length)}</div>
          </div>
        {/if}
        <div class="change muted">
          <div class="change-icon"><Icon name="equal" size={18} /></div>
          <div style="flex: 1">
            <div class="change-title">Already there</div>
            <div class="small">Skipped, nothing sent</div>
          </div>
          <div class="count">{num(diff.existing.length)}</div>
        </div>
      </section>

      {#if contained.length}
        <section class="card strong">
          <div class="stack" style="gap: 6px">
            <h2 style="font-size: 17px; line-height: 1.3; font-weight: 700">
              {containedCount === 1
                ? '1 older highlight is now inside a longer one'
                : `${num(containedCount)} older highlights are now inside a longer one`}
            </h2>
            <p style="font-size: 14px; line-height: 1.5; color: var(--ink-2)">
              Delete {containedCount === 1 ? 'it' : 'them'} so the passage isn't in Readwise twice?
              {containedCount === 1 ? 'Its note moves' : 'Their notes move'} to the longer highlight.
            </p>
          </div>
          {#each contained as m (m.existing.id)}
            <blockquote class="quote">{short(m.highlight.text, 400)}</blockquote>
            <ul class="stack">
              {#each m.alsoContains as old (old.id)}
                <li class="delete-item">
                  <span class="delete-tag">Delete</span>
                  <span class="deleted">{short(old.text)}</span>
                </li>
              {/each}
            </ul>
          {/each}
          <label class="check">
            <input type="checkbox" bind:checked={app.deleteContained} />
            <span>Delete the {containedCount === 1 ? 'older highlight' : `${num(containedCount)} older highlights`}</span>
          </label>
          <p class="small">Leave it unchecked and they stay as they are.</p>
        </section>
      {/if}

      {#if warnings.length}
        <section class="warn">
          <Icon name="warn" color="#7A4F00" />
          <div class="stack" style="gap: 4px">
            <div class="message-title">
              {warnings.length === 1 ? "1 block couldn't be read" : `${num(warnings.length)} blocks couldn't be read`}
            </div>
            <div>
              {#if warnings.length === 1}
                Block #{warnings[0]!.index} ({warnings[0]!.reason}) is skipped. Everything else syncs.
              {:else}
                They're skipped. Everything else syncs.
              {/if}
            </div>
            {#if !wide}
              <button class="inline-link" type="button" style="color: inherit; font-size: 14px; padding: 4px 0" onclick={() => (app.screen = 'details')}>
                View {warnings.length === 1 ? 'block' : 'blocks'}
              </button>
            {/if}
          </div>
        </section>
      {/if}

      {#if plan.tooLong.length}
        <section class="warn">
          <Icon name="warn" color="#7A4F00" />
          <div class="stack" style="gap: 4px">
            <div class="message-title">{plural(plan.tooLong.length, 'highlight')} too long for Readwise</div>
            <div>
              Readwise accepts up to 8,191 characters per highlight, so
              {plan.tooLong.length === 1 ? 'it is' : 'they are'} left out. Highlight {plan.tooLong
                .map((h) => h.id)
                .join(', ')} in the cleanup details.
            </div>
          </div>
        </section>
      {/if}

      {#if !wide}<div class="spacer"></div>{/if}
      <button class="btn tall" type="button" disabled={app.busy} onclick={() => app.sync()}>
        <span>Sync to Readwise</span>
        <span class="sub">{summary}</span>
      </button>
    </div>

    {#if wide}
      <section class="card details-panel">
        <Details inline />
      </section>
    {/if}
  </div>
{/if}

<style>
  .book-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 14px;
  }
  .book-title {
    font-size: 24px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
  :global(.page.wide) .book-title {
    font-size: 28px;
  }
  .author {
    font-size: 15px;
    color: var(--muted);
  }
  .columns {
    display: flex;
    flex-direction: column;
    gap: 18px;
    flex: 1;
  }
  .columns.wide {
    flex-direction: row;
    align-items: flex-start;
    gap: 24px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 18px;
    flex: 1;
  }
  .wide .side {
    flex: 0 0 380px;
    position: sticky;
    top: 16px;
  }
  .details-panel {
    flex: 1;
    min-width: 0;
    padding: 20px;
  }
  .row {
    display: flex;
    justify-content: space-between;
  }
  .row.muted {
    color: var(--muted);
  }
  .row.total {
    font-weight: 700;
    font-size: 17px;
  }
  .rule {
    height: 1px;
    background: var(--line);
  }
  .merge {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding-top: 4px;
  }
  .change {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .change.muted {
    color: var(--muted);
  }
  .change-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--muted-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .change-icon.accent {
    background: var(--accent-soft);
  }
  .change-title {
    font-size: 15px;
    font-weight: 600;
  }
  .count {
    font-size: 20px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  blockquote {
    padding: 14px;
    border-radius: 12px;
    background: var(--surface-2);
  }
  ul {
    list-style: none;
    padding: 0;
  }
  .delete-item {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .delete-tag {
    font-size: 12px;
    font-weight: 600;
    color: var(--danger);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }
  .deleted {
    font-family: var(--serif);
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-2);
    text-decoration: line-through;
    text-decoration-color: var(--danger);
  }
</style>
