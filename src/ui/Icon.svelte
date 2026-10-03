<script lang="ts">
  const PATHS = {
    external: ['M14 4h6v6', 'M20 4 10 14', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    lock: ['M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
    upload: ['M12 20V8', 'm7 13 5-5 5 5', 'M5 4h14'],
    download: ['M12 4v12', 'm7 11 5 5 5-5', 'M5 20h14'],
    back: ['M19 12H5', 'm12 19-7-7 7-7'],
    forward: ['M5 12h14', 'm12 5 7 7-7 7'],
    file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
    plus: ['M12 5v14', 'M5 12h14'],
    pencil: ['M4 20h4L19 9l-4-4L4 16z'],
    equal: ['M5 9h14', 'M5 15h14'],
    extend: ['M3 12h18', 'm7 8-4 4 4 4', 'm17 8 4 4-4 4'],
    check: ['M20 6 9 17l-5-5'],
    warn: ['M12 3 2 21h20z', 'M12 10v5', 'M12 18h.01'],
    offline: ['M2 8.8a15 15 0 0 1 4.2-2.6', 'M9.7 5.2A15 15 0 0 1 22 8.8', 'M5 12.5a10 10 0 0 1 5.2-2.6', 'M16.7 11a10 10 0 0 1 2.3 1.5', 'M8.5 16.1a5 5 0 0 1 7 0', 'M12 20h.01', 'M2 2l20 20'],
    shield: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', 'M12 8v5', 'M12 16h.01'],
  } as const;

  let {
    name,
    size = 20,
    stroke = 2,
    color = 'currentColor',
  }: { name: keyof typeof PATHS; size?: number; stroke?: number; color?: string } = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each PATHS[name] as d (d)}<path {d} />{/each}
</svg>
