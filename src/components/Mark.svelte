<script lang="ts">
  /** The Codera mark: the </> glyph on the green→blue tile. */
  let { size = 28 }: { size?: number } = $props();
  const id = 'mk' + Math.random().toString(36).slice(2, 8);
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-label="Codera">
  <defs>
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
      <stop offset="0" stop-color="#22c55e" />
      <stop offset="1" stop-color="#60a5fa" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="30" fill="url(#{id})" />
  <path
    d="M35 35.5 L21.5 50 L35 64.5 M65 35.5 L78.5 50 L65 64.5 M55.5 32.5 L44.5 67.5"
    fill="none" stroke="#fff" stroke-width={size >= 48 ? 6.2 : 7.5}
    stroke-linecap="round" stroke-linejoin="round"
  />
</svg>
