<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { face, type Post } from '../lib/state.svelte';
  import { ago, clock, plural } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { userHref } from '../lib/social.svelte';

  let { post, index = 0 }: { post: Post; index?: number } = $props();

  const who = $derived(face(post));
  const isVideo = $derived(post.type !== 'post');

  let preview: HTMLVideoElement | undefined = $state();

  // A frame a little way in, rather than the black first frame most recordings
  // open on; hovering plays a silent preview from there.
  function poster() {
    if (!preview || !preview.duration) return;
    preview.currentTime = Math.min(3, preview.duration * 0.25);
  }

  const open = () => go(post.type === 'short' ? `shorts/${post.id}` : `watch/${post.id}`);
</script>

{#if isVideo}
  <div class="card" style:--i={Math.min(index, 14)} onclick={open} onkeydown={e => e.key === 'Enter' && open()} role="link" tabindex="0"
    onmouseenter={() => preview?.play().catch(() => {})}
    onmouseleave={() => { preview?.pause(); poster(); }}>
    <div class="thumb" class:tall={post.type === 'short'}>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={preview} src={post.videoUrl} preload="metadata" muted playsinline onloadedmetadata={poster}></video>
      {#if post.type === 'short'}<span class="badge short">SHORT</span>
      {:else if post.duration}<span class="badge">{clock(post.duration)}</span>{/if}
      {#if post.type === 'live'}<span class="badge stream">STREAM</span>{/if}
    </div>
    <div class="meta">
      <Avatar name={who.name} photo={who.photo} size={34} />
      <div class="words">
        <h3>{post.title}</h3>
        <a class="muted who" href={userHref(post)} onclick={e => e.stopPropagation()}>{who.name}</a>
        <div class="muted">{plural(post.likeCount, 'like')} · {ago(post.createdAt)}</div>
      </div>
    </div>
  </div>
{:else}
  <div class="card text" style:--i={Math.min(index, 14)} onclick={open} onkeydown={e => e.key === 'Enter' && open()} role="link" tabindex="0">
    <div class="head">
      <Avatar name={who.name} photo={who.photo} size={28} />
      <span class="muted"><a class="who" href={userHref(post)} onclick={e => e.stopPropagation()}>{who.name}</a> · {ago(post.createdAt)}</span>
    </div>
    <h3>{post.title}</h3>
    {#if post.imageUrl}<img class="pic" src={post.imageUrl} alt="" loading="lazy" draggable="false" />{/if}
    {#if post.body}<p class="body">{post.body}</p>{/if}
    {#if post.code}<pre class="code">{post.code.split('\n').slice(0, 6).join('\n')}</pre>{/if}
    <div class="muted small">{plural(post.likeCount, 'like')} · {plural(post.commentCount, 'comment')}</div>
  </div>
{/if}

<style>
  .card {
    all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column;
    transition: transform .2s cubic-bezier(.2, .9, .3, 1); min-width: 0; align-self: start;
  }
  .card:hover { transform: translateY(-3px); }
  .card:focus-visible { outline: 2px solid var(--blue); outline-offset: 4px; border-radius: var(--radius); }

  .thumb { position: relative; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; background: #000; transition: border-radius .2s; }
  .thumb.tall { aspect-ratio: 9 / 14; }
  .card:hover .thumb { border-radius: 8px; }
  .thumb video { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s; }
  .card:hover .thumb video { transform: scale(1.05); }
  .badge { position: absolute; right: 8px; bottom: 8px; padding: 2px 6px; border-radius: 6px; background: rgba(0,0,0,.78); color: #fff; font-size: 11.5px; font-weight: 700; }
  .badge.short { left: 8px; right: auto; background: var(--brand); }
  .badge.stream { left: 8px; right: auto; background: #ef4444; letter-spacing: .4px; }
  .who { display: block; width: fit-content; }
  .who:hover { color: var(--text); text-decoration: underline; }

  .meta { display: flex; gap: 11px; padding: 11px 2px 0; }
  .words { min-width: 0; }
  h3 {
    margin: 0 0 3px; font-size: 14.5px; font-weight: 800; line-height: 1.32; letter-spacing: -0.2px;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card:hover h3 { color: var(--blue); }
  .muted { font-size: 12.5px; font-weight: 600; }

  .text { gap: 9px; padding: 15px 16px; border-radius: var(--radius); background: var(--bg2); border: 1px solid var(--line); }
  .text:hover { border-color: color-mix(in srgb, var(--blue) 40%, var(--line)); box-shadow: 0 14px 34px rgba(0,0,0,.2); }
  .head { display: flex; align-items: center; gap: 9px; }
  .text h3 { font-size: 15.5px; margin: 0; }
  .pic { width: 100%; max-height: 220px; object-fit: cover; border-radius: 10px; }
  .body { margin: 0; color: var(--muted); font-size: 13.5px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .code { margin: 0; padding: 12px; border-radius: 10px; background: var(--bg3); border: 1px solid var(--line); font: 12.5px/1.6 'Cascadia Code', Consolas, monospace; overflow: hidden; white-space: pre; }
  .small { font-size: 12px; }
</style>
