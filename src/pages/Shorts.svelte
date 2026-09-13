<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { session, face } from '../lib/state.svelte';
  import { vote, watchMyVote } from '../lib/actions';
  import { ago, compact } from '../lib/format';
  import { go } from '../lib/router.svelte';

  let { id = '' }: { id?: string } = $props();

  const shorts = $derived(session.posts.filter(p => p.type === 'short'));
  let feed: HTMLDivElement | undefined = $state();
  let votes = $state<Record<string, number>>({});

  // One short plays at a time: whichever fills the window.
  onMount(() => {
    if (!feed) return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const v = e.target.querySelector('video');
        if (!v) continue;
        if (e.isIntersecting && e.intersectionRatio > 0.6) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
        else v.pause();
      }
    }, { root: feed, threshold: [0, 0.6, 1] });
    const watch = () => feed?.querySelectorAll('.short').forEach(el => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(feed, { childList: true });
    if (id) feed.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView();
    return () => { io.disconnect(); mo.disconnect(); };
  });

  $effect(() => {
    const stops = shorts.map(p => watchMyVote(p.id, v => (votes[p.id] = v)));
    return () => stops.forEach(s => s());
  });

  // Up and down keys move between shorts, as a scroll wheel would.
  function keys(e: KeyboardEvent) {
    if (!feed || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    feed.scrollBy({ top: (e.key === 'ArrowDown' ? 1 : -1) * feed.clientHeight, behavior: 'smooth' });
  }
</script>

<svelte:window onkeydown={keys} />

{#if !shorts.length}
  <div class="empty">
    <b>No shorts yet</b>
    <span class="muted">Shorts are up to a minute. Post one with Create.</span>
  </div>
{:else}
  <div class="feed" bind:this={feed}>
    {#each shorts as p (p.id)}
      {@const who = face(p)}
      <section class="short" data-id={p.id}>
        <div class="stage">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={p.videoUrl} loop playsinline preload="metadata"
            onclick={e => { const v = e.currentTarget as HTMLVideoElement; v.paused ? v.play() : v.pause(); }}></video>
          <div class="cap">
            <div class="by"><Avatar name={who.name} photo={who.photo} size={28} /><b>{who.name}</b><span>· {ago(p.createdAt)}</span></div>
            <div class="title">{p.title}</div>
          </div>
        </div>
        <div class="side">
          <button class="sb" class:on={votes[p.id] === 1} onclick={() => vote(p.id, 1)}><span><Icon name="up" size={22} /></span>{compact(p.likeCount)}</button>
          <button class="sb" class:down={votes[p.id] === -1} onclick={() => vote(p.id, -1)}><span><Icon name="down" size={22} /></span>{compact(p.dislikeCount)}</button>
          <button class="sb" onclick={() => go(`watch/${p.id}`)}><span><Icon name="comment" size={22} /></span>{compact(p.commentCount)}</button>
        </div>
      </section>
    {/each}
  </div>
{/if}

<style>
  .empty { height: 100%; display: grid; place-content: center; justify-items: center; gap: 6px; }
  .feed { height: 100%; overflow-y: auto; scroll-snap-type: y mandatory; }
  .feed::-webkit-scrollbar { display: none; }
  .short { height: 100%; scroll-snap-align: start; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 14px; }
  .stage { position: relative; height: min(100%, 86vh); aspect-ratio: 9 / 16; border-radius: 18px; overflow: hidden; background: #000; }
  video { width: 100%; height: 100%; object-fit: contain; display: block; cursor: pointer; }
  .cap { position: absolute; inset: auto 0 0 0; padding: 50px 16px 18px; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,.75)); pointer-events: none; }
  .by { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .by span { opacity: .75; }
  .title { font-size: 15.5px; font-weight: 800; margin-top: 8px; }
  .side { display: flex; flex-direction: column; gap: 14px; align-self: flex-end; padding-bottom: 30px; }
  .sb { border: 0; background: none; display: grid; justify-items: center; gap: 4px; font-weight: 700; font-size: 12px; color: var(--text); }
  .sb span { width: 50px; height: 50px; border-radius: 99px; display: grid; place-items: center; background: var(--bg3); border: 1px solid var(--line); transition: transform .15s; }
  .sb:hover span { transform: scale(1.06); }
  .sb.on span { color: var(--blue); border-color: color-mix(in srgb, var(--blue) 45%, var(--line)); }
  .sb.down span { color: var(--red); border-color: color-mix(in srgb, var(--red) 45%, var(--line)); }
</style>
