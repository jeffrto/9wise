<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { explainMerge, stripFootnotes, toMarkdown } from '../../core/clean.ts';
  import { app } from '../app.svelte.ts';
  import { clock, download, num, plural, ranges } from '../format.ts';
  import Icon from '../Icon.svelte';

  let { inline = false }: { inline?: boolean } = $props();

  type Filter = 'all' | 'merged' | 'duplicates' | 'ignored';
  let filter = $state<Filter>('all');
  const open = new SvelteSet<number>();

  const parsed = $derived(app.parsed!);
  const cleaned = $derived(app.cleaned!);
  const blocks = $derived(new Map(parsed.blocks.map((b) => [b.index, b])));
  const duplicates = $derived.by(() => {
    const byHighlight = new Map<number, Map<number, number[]>>();
    for (const f of cleaned.trace) {
      if (f.kind !== 'duplicate') continue;
      const groups = byHighlight.get(f.highlight) ?? new Map<number, number[]>();
      groups.set(f.of, [...(groups.get(f.of) ?? []), f.block]);
      byHighlight.set(f.highlight, groups);
    }
    return byHighlight;
  });
  const merged = $derived(cleaned.highlights.filter((h) => h.sources.length > 1));
  const withDuplicates = $derived(cleaned.highlights.filter((h) => duplicates.has(h.id)));
  const list = $derived(filter === 'merged' ? merged : filter === 'duplicates' ? withDuplicates : cleaned.highlights);
  const dupCount = (id: number) => [...(duplicates.get(id)?.values() ?? [])].reduce((n, l) => n + l.length, 0);

  const chips = $derived(
    (
      [
        ['all', 'All', cleaned.highlights.length],
        ['merged', 'Merged', merged.length],
        ['duplicates', 'Duplicates', cleaned.stats.duplicates],
        ['ignored', 'Ignored', parsed.warnings.length],
      ] as const
    ).filter(([key, , n]) => key === 'all' || n > 0),
  );

  function toggle(id: number) {
    if (open.has(id)) open.delete(id);
    else open.add(id);
  }

  function back() {
    if (app.diff) app.showPreview();
    else app.screen = 'offline';
  }

  const save = () => download(`${parsed.bookTitle} - Bookmarks (clean).md`, toMarkdown(cleaned.highlights));
</script>

{#if !inline}
  <button class="back" type="button" onclick={back}><Icon name="back" size={16} />Back to preview</button>
{/if}

<div class="head">
  {#if inline}
    <h2 style="font-size: 20px; font-weight: 700; letter-spacing: -0.01em">Cleanup details</h2>
    <button class="btn secondary small" type="button" onclick={save}>
      <Icon name="download" size={16} />Download clean file (.md)
    </button>
  {:else}
    <h1 class="title" style="font-size: 26px">Cleanup details</h1>
  {/if}
</div>

{#if cleaned.check.ok}
  <section class="ok">
    <span class="tick"><Icon name="check" size={16} stroke={3} color="#fff" /></span>
    <div class="stack" style="gap: 4px">
      <div class="message-title">All original text is in the clean highlights</div>
      <div class="small" style="color: #1d5c3b">
        Checked all {num(parsed.blocks.length)} readable blocks.
        {#if parsed.warnings.length === 1}
          Block #{parsed.warnings[0]!.index} couldn't be read; it's under Ignored.
        {:else if parsed.warnings.length}
          {num(parsed.warnings.length)} blocks couldn't be read; they're under Ignored.
        {/if}
      </div>
    </div>
  </section>
{:else}
  <section class="alert" role="alert">
    <Icon name="warn" color="var(--danger)" />
    <div class="stack" style="gap: 4px">
      <div class="message-title">{plural(cleaned.check.missing.length, 'block')} missing from the clean highlights</div>
      <div>{ranges(cleaned.check.missing)}. Nothing will be sent until this is fixed.</div>
    </div>
  </section>
{/if}

<div class="chips">
  {#each chips as [key, label, n] (key)}
    <button class="chip" type="button" aria-pressed={filter === key} onclick={() => (filter = key)}>
      {label} · {num(n)}
    </button>
  {/each}
</div>

{#if filter === 'ignored'}
  <ol class="items">
    {#each parsed.warnings as w (w.index)}
      <li class="item ignored">
        <div class="meta" style="color: var(--warn-ink)">
          <span style="font-weight: 600">Block #{w.index} · ignored</span>
          <span>{w.reason}</span>
        </div>
        <p class="small" style="color: var(--warn-ink)">
          It can't be placed in the book, so it isn't sent. Fix the file and sync again to include it.
        </p>
        <pre>{w.raw}</pre>
      </li>
    {/each}
  </ol>
{:else}
  <ol class="items">
    {#each list as h (h.id)}
      {@const dups = duplicates.get(h.id)}
      {@const expandable = h.sources.length > 1 || !!dups}
      {@const expanded = open.has(h.id)}
      <li class="item" class:expanded>
        <svelte:element
          this={expandable ? 'button' : 'div'}
          class="summary"
          type={expandable ? 'button' : undefined}
          aria-expanded={expandable ? expanded : undefined}
          onclick={expandable ? () => toggle(h.id) : undefined}
          role={expandable ? undefined : 'group'}
        >
          <span class="meta num">
            <span>Highlight {h.id} · {clock(h.start)}</span>
            {#if h.sources.length > 1}
              <span class="badge accent">merged from {h.sources.length}</span>
            {:else}
              <span class="badge">kept{#if dups} · {plural(dupCount(h.id), 'duplicate')}{/if}</span>
            {/if}
          </span>
          <span class="quote text">{h.text}</span>
          {#if h.note}<span class="note"><strong>Note:</strong> {h.note}</span>{/if}
        </svelte:element>

        {#if expanded}
          <div class="sources">
            {#if h.sources.length > 1}
              {@const texts = h.sources.map((i) => stripFootnotes(blocks.get(i)?.text ?? '').trim())}
              <div class="eyebrow" style="font-size: 12px">Original blocks · new text marked</div>
              {#each explainMerge(texts) as segments, k (h.sources[k])}
                {@const b = blocks.get(h.sources[k]!)}
                <div class="stack" style="gap: 3px">
                  <div class="block-meta num">#{b?.index} · {clock(b?.start ?? 0)} – {clock(b?.end ?? 0)}</div>
                  <div class="block-text">
                    {#each segments as s, j (j)}{#if s.added}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}
                  </div>
                </div>
              {/each}
            {:else}
              {@const b = blocks.get(h.sources[0]!)}
              <div class="block-meta num">#{b?.index} · {clock(b?.start ?? 0)} – {clock(b?.end ?? 0)}</div>
            {/if}
            {#each [...(dups ?? [])] as [of, copies] (of)}
              <div class="small">
                {ranges(copies)} · {plural(copies.length, 'exact copy', 'exact copies')} of #{of}, removed
              </div>
            {/each}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
{/if}

{#if !inline}
  <div class="spacer"></div>
  <div class="stack" style="gap: 8px">
    <button class="btn secondary" type="button" onclick={save}>
      <Icon name="download" size={18} />Download clean file (.md)
    </button>
    <p class="small" style="text-align: center">Same format as ElevenReader, to check in any text editor.</p>
  </div>
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .tick {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: var(--ok);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
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
    display: flex;
    flex-direction: column;
  }
  .item.expanded {
    border: 2px solid var(--ink);
    margin: -1px;
  }
  .summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    text-align: left;
    border: none;
    background: none;
    border-radius: 14px;
  }
  button.summary {
    cursor: pointer;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--muted);
  }
  .badge {
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--muted-bg);
    color: var(--ink-2);
    font-weight: 500;
    white-space: nowrap;
  }
  .badge.accent {
    background: var(--accent-soft);
    color: #5c4700;
    font-weight: 600;
  }
  .text {
    white-space: pre-wrap;
  }
  .note {
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink-2);
    white-space: pre-wrap;
  }
  .note strong {
    font-weight: 600;
  }
  .sources {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0 16px;
    padding: 12px 0 14px;
    border-top: 1px solid var(--line-2);
  }
  .block-meta {
    font-size: 12px;
    color: var(--muted);
  }
  .block-text {
    font-family: var(--serif);
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-2);
    white-space: pre-wrap;
  }
  .item.ignored {
    background: #fffbeb;
    border: 1.5px dashed #d9b44a;
    padding: 14px 16px;
    gap: 8px;
  }
  pre {
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--warn-line);
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    color: var(--ink-2);
  }
</style>
