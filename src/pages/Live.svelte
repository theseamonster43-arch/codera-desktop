<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import PostCard from '../components/PostCard.svelte';
  import StreamCard from '../components/StreamCard.svelte';
  import { session } from '../lib/state.svelte';
  import { social, onAir } from '../lib/social.svelte';
  import { rank } from '../lib/taste.js';

  /** Streams on air now, and the ones people kept. */
  const now = $derived(social.streams.filter(onAir).sort((a, b) => (b.watching || 0) - (a.watching || 0)));
  const saved = $derived(rank(session.posts.filter(p => p.type === 'live'), social.taste, social.following));
</script>

<div class="page wrap">
  <div class="head">
    <div>
      <h1><Icon name="live" size={24} /> Live</h1>
      <p class="muted">Streams happening now, and the ones people saved.</p>
    </div>
    <a class="btn brand big" href="#/golive"><Icon name="live" size={18} />Go live</a>
  </div>

  <h2>On air now</h2>
  {#if now.length}
    <div class="grid stagger">{#each now as s, i (s.id)}<StreamCard stream={s} index={i} />{/each}</div>
  {:else}
    <div class="empty"><b>Nobody is live right now</b><span class="muted">Start one yourself with Go live. Your followers see it straight away.</span></div>
  {/if}

  <h2>Saved streams</h2>
  {#if saved.length}
    <div class="grid stagger">{#each saved as post, i (post.id)}<PostCard {post} index={i} />{/each}</div>
  {:else}
    <div class="empty"><b>No saved streams yet</b><span class="muted">When a streamer keeps their stream at the end, it goes here.</span></div>
  {/if}
</div>

<style>
  .wrap { padding: 20px 28px 48px; }
  .head { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
  .head > div { flex: 1; min-width: 220px; }
  h1 { margin: 4px 0 4px; font-size: 26px; font-weight: 900; letter-spacing: -0.7px; display: flex; align-items: center; gap: 10px; }
  h1 + p { margin: 0; }
  h2 { margin: 28px 0 12px; font-size: 17px; font-weight: 800; }
  .grid { display: grid; gap: 26px 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .empty { display: grid; gap: 6px; justify-items: center; text-align: center; padding: 40px 20px; }
  .empty b { font-size: 16px; }
</style>
