<script lang="ts">
  let { name = '', photo = null, size = 34 }: { name?: string; photo?: string | null; size?: number } = $props();
  const initial = $derived((name || '?').trim().charAt(0).toUpperCase() || '?');
</script>

<span class="av" style:width="{size}px" style:height="{size}px" style:font-size="{Math.round(size * 0.42)}px">
  {#if photo}<img src={photo} alt="" draggable="false" />{:else}{initial}{/if}
</span>

<style>
  .av {
    border-radius: 999px; flex: none; overflow: hidden; display: grid; place-items: center;
    background: var(--brand); color: #fff; font-weight: 800;
  }
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
