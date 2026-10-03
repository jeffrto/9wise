<script lang="ts">
  import { app } from '../app.svelte.ts';
  import { duration, plural } from '../format.ts';
  import Icon from '../Icon.svelte';

  const length = $derived(Math.max(0, ...(app.parsed?.blocks.map((b) => b.end) ?? [])));
</script>

<div class="file">
  <Icon name="file" size={22} color="var(--muted)" />
  <div style="min-width: 0">
    <div class="name">{app.fileName}</div>
    <div class="small">{plural(app.parsed?.total ?? 0, 'block')} · {duration(length)} of audio</div>
  </div>
</div>

<style>
  .file {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .file :global(.icon) {
    flex-shrink: 0;
  }
  .name {
    font-size: 15px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
</style>
