<script lang="ts">
  let { title, url = null, size = 'md' }: { title: string; url?: string | null; size?: 'sm' | 'md' } = $props();
  let failedUrl = $state<string | null>(null);
</script>

{#if url && failedUrl !== url}
  <img class="cover {size}" src={url} alt="" referrerpolicy="no-referrer" onerror={() => (failedUrl = url)} />
{:else}
  <div class="cover {size} placeholder" aria-hidden="true">{title}</div>
{/if}

<style>
  .cover {
    flex-shrink: 0;
    border-radius: 3px 5px 5px 3px;
    object-fit: cover;
    background: #33443a;
  }
  .md {
    width: 48px;
    height: 70px;
  }
  .sm {
    width: 40px;
    height: 58px;
  }
  .placeholder {
    color: #efe6cc;
    font-family: var(--serif);
    font-size: 9px;
    line-height: 1.15;
    display: flex;
    align-items: flex-end;
    padding: 5px;
    overflow: hidden;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  .sm.placeholder {
    font-size: 8px;
  }
</style>
