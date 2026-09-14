<script lang="ts">
  import Player from '../components/Player.svelte';
  import { session } from '../lib/state.svelte';

  /** The mini player window: only the video. Its title bar and buttons are the system's own. */
  let { id, start = 0 }: { id: string; start?: number } = $props();
  const post = $derived(session.posts.find(p => p.id === id));
</script>

<div class="mini">
  {#if post?.videoUrl}
    <div class="body"><Player src={post.videoUrl} postId={post.id} {start} mini /></div>
  {:else}
    <div class="wait"><div class="spinner"></div></div>
  {/if}
</div>

<style>
  .mini { height: 100%; display: grid; background: #000; }
  .body { min-height: 0; }
  .wait { display: grid; place-items: center; }
</style>
