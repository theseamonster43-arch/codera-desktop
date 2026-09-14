<script lang="ts">
  import Player from '../components/Player.svelte';
  import WindowControls from '../components/WindowControls.svelte';
  import { session } from '../lib/state.svelte';
  import { inTauri } from '../lib/native';

  /** The mini player window: the video under a slim bar to drag it by, with the window buttons. */
  let { id, start = 0 }: { id: string; start?: number } = $props();
  const post = $derived(session.posts.find(p => p.id === id));
</script>

<div class="mini" class:framed={inTauri && !navigator.userAgent.includes('Mac')}>
  {#if inTauri && !navigator.userAgent.includes('Mac')}
    <div class="grip" data-tauri-drag-region><span data-tauri-drag-region>{post?.title || 'Codera'}</span></div>
    <WindowControls compact />
  {/if}
  {#if post?.videoUrl}
    <div class="body"><Player src={post.videoUrl} postId={post.id} {start} mini /></div>
  {:else}
    <div class="wait"><div class="spinner"></div></div>
  {/if}
</div>

<style>
  .mini { height: 100%; display: grid; background: #000; }
  .mini.framed { grid-template-rows: 32px 1fr; }
  .grip {
    display: flex; align-items: center; padding: 0 150px 0 12px; color: #fff; font-size: 12.5px; font-weight: 700;
    background: linear-gradient(90deg, rgba(34,197,94,.25), rgba(59,130,246,.25)), #0b0f0d;
  }
  .grip span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .body { min-height: 0; }
  .wait { display: grid; place-items: center; }
</style>
