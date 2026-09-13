<script lang="ts">
  import { ICONS } from '../lib/icons';

  let { name, size = 20, stroke }: { name: string; size?: number; stroke?: number } = $props();
</script>

<svg
  class="i"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  style:width="{size}px"
  style:height="{size}px"
  style:stroke-width={stroke}
  aria-hidden="true"
>{@html ICONS[name] || ''}</svg>
