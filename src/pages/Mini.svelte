<script lang="ts">
  import Player from '../components/Player.svelte';
  import Icon from '../components/Icon.svelte';
  import { session } from '../lib/state.svelte';
  import { closeWindow, startDrag, inTauri } from '../lib/native';

  /** The mini player window: only the video, a handle to drag it by, and a close button. */
  let { id, start = 0 }: { id: string; start?: number } = $props();
  const post = $derived(session.posts.find(p => p.id === id));
</script>

<div class="mini">
  <div class="grip" onpointerdown={() => inTauri && startDrag()} role="presentation">
    <span>{post?.title || 'Codera'}</span>
    <button class="x" onclick={() => (inTauri ? closeWindow() : window.close())} aria-label="Close"><Icon name="close" size={15} /></button>
  </div>
  {#if post?.videoUrl}
    <div class="body"><Player src={post.videoUrl} postId={post.id} {start} mini /></div>
  {:else}
    <div class="wait"><div class="spinner"></div></div>
  {/if}
</div>

<style>
  .mini { height: 100%; display: grid; grid-template-rows: auto 1fr; background: #000; }
  .grip {
    display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 4px 0 12px; color: #fff; cursor: grab;
    background: linear-gradient(90deg, rgba(34,197,94,.25), rgba(59,130,246,.25)), #0b0f0d; font-size: 12.5px; font-weight: 700;
  }
  .grip span { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .x { width: 26px; height: 24px; border: 0; border-radius: 6px; background: transparent; color: #fff; display: grid; place-items: center; }
  .x:hover { background: #e81123; }
  .body { min-height: 0; }
  .wait { display: grid; place-items: center; }
</style>
