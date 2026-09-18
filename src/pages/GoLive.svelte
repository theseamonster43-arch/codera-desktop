<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import ChatPanel from '../components/ChatPanel.svelte';
  import { studio, goLive, endLive, saveStream, dropStream, watchStreamDoc, type Stream } from '../lib/social.svelte';
  import { capture, canStream, elapsed } from '../lib/live.js';
  import { compact, human } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { say } from '../lib/sheet.svelte';

  /**
   * Going live: choose the camera or the screen, name the stream, go. While
   * live, this page is the studio: the preview, the counts, the chat and the
   * button that ends it, followed by the question of whether to keep it.
   */
  let source = $state<'camera' | 'screen'>('camera');
  let media = $state<MediaStream | null>(null);
  let title = $state('');
  let err = $state('');
  let starting = $state(false);
  let handedOver = false;

  let preview: HTMLVideoElement | undefined = $state();
  let doc = $state<Stream | null>(null);

  // What is left after a stream ends, until it is saved or let go.
  let ended = $state<{ id: string; title: string; blob: Blob; secs: number } | null>(null);
  let saving = $state<number | null>(null);

  const live = $derived(studio.now);
  const running = $derived(live ? (studio.tick, elapsed(Date.now() - live.startedAt)) : '');

  $effect(() => {
    if (preview) preview.srcObject = live ? live.media : media;
  });

  $effect(() => {
    if (!live) return;
    return watchStreamDoc(live.id, s => (doc = s));
  });

  // Anything picked but never taken live is let go when the page is left.
  $effect(() => () => { if (media && !handedOver) media.getTracks().forEach(t => t.stop()); });

  async function pick(src: 'camera' | 'screen') {
    source = src;
    err = '';
    try {
      const m = await capture(src);
      if (media && media !== m) media.getTracks().forEach(t => t.stop());
      media = m;
    } catch {
      media = null;
      err = src === 'screen'
        ? 'Screen sharing was cancelled or blocked.'
        : 'Codera can’t use the camera. Allow it for Codera in your system’s privacy settings, then try again.';
    }
  }

  if (canStream() && !studio.now) pick('camera');

  async function start() {
    if (!title.trim()) { err = 'Give your stream a title.'; return; }
    starting = true;
    err = '';
    try {
      if (!media) await pick(source);
      if (!media) throw new Error(err || 'Nothing to share yet.');
      handedOver = true;
      await goLive(title, media);
    } catch (e) {
      handedOver = false;
      err = human(e);
    }
    starting = false;
  }

  async function end() {
    const out = await endLive();
    media = null;
    if (!out) return;
    if (!out.blob) { dropStream(out.id); say('Stream ended.'); go('live'); return; }
    ended = { id: out.id, title: out.title, blob: out.blob, secs: out.secs };
  }

  async function keep() {
    if (!ended) return;
    saving = 0;
    try {
      await saveStream(ended.id, ended.title, ended.blob, ended.secs, f => (saving = f));
      ended = null;
      say('Saved. It’s on the Live page.');
      go('live');
    } catch (e) {
      saving = null;
      err = human(e);
    }
  }

  function discard() {
    if (!ended) return;
    dropStream(ended.id);
    ended = null;
    say('Stream ended. It wasn’t saved.');
    go('live');
  }
</script>

{#if ended}
  <div class="page narrow">
    <h1><Icon name="live" size={24} /> Save this stream?</h1>
    <p class="muted">“{ended.title}” ran for {elapsed(ended.secs * 1000)}. Saved streams go on your page and on the Live page, where people can watch them back. Nothing has been uploaded yet.</p>
    {#if saving !== null}<div class="bar"><i style:width="{Math.round(saving * 100)}%"></i></div>{/if}
    {#if err}<p class="err">{err}</p>{/if}
    <div class="row">
      <button class="btn" onclick={discard} disabled={saving !== null}>Don’t save</button>
      <button class="btn brand big" onclick={keep} disabled={saving !== null}>
        {saving !== null ? 'Uploading…' : `Save stream (${Math.max(1, Math.round(ended.blob.size / 1048576))} MB)`}
      </button>
    </div>
  </div>
{:else if live}
  <div class="page studio">
    <div class="main">
      <div class="stage">
        <video bind:this={preview} muted playsinline autoplay></video>
        <span class="tag">LIVE</span>
        <span class="time">{running}</span>
      </div>
      <h1 class="title">{live.title}</h1>
      <div class="byline">
        <div class="stats">
          <span><b>{compact(live.watching)}</b> watching</span>
          <span><Icon name="up" size={18} /><b>{compact(doc?.likeCount || 0)}</b></span>
          <span><Icon name="down" size={18} /><b>{compact(doc?.dislikeCount || 0)}</b></span>
          {#if doc?.tips}<span><Icon name="tip" size={18} /><b>${(doc.tips / 100).toFixed(2)}</b> in tips</span>{/if}
        </div>
        <button class="btn danger" onclick={end}>End stream</button>
      </div>
      <p class="muted note">Viewers find you on the Live page, and everyone who follows you sees you at the top of Following. Only you see this preview.</p>
    </div>
    <ChatPanel streamId={live.id} hostUid={live.uid} />
  </div>
{:else if !canStream()}
  <div class="page narrow"><div class="empty"><b>Streaming isn’t available here</b><span class="muted">This system’s web view can’t reach a camera or screen.</span></div></div>
{:else}
  <div class="page narrow">
    <h1><Icon name="live" size={24} /> Go live</h1>
    <p class="muted">Stream your camera or your screen. People watch on the website, the app and the desktop app, and chat alongside.</p>
    <div class="stage">
      <video bind:this={preview} muted playsinline autoplay></video>
      {#if !media}<div class="none"><Icon name={source === 'camera' ? 'camera' : 'screen'} size={30} /><span>Choose what to share</span></div>{/if}
    </div>
    <div class="chips">
      <button class="chip" class:on={source === 'camera'} onclick={() => pick('camera')}><Icon name="camera" size={16} />Camera</button>
      <button class="chip" class:on={source === 'screen'} onclick={() => pick('screen')}><Icon name="screen" size={16} />Screen</button>
    </div>
    <input class="field" bind:value={title} maxlength="120" placeholder="What are you streaming? e.g. Building a Python bot"
      onkeydown={e => e.key === 'Enter' && start()} />
    {#if err}<p class="err">{err}</p>{/if}
    <div class="row">
      <a class="btn" href="#/live">Cancel</a>
      <button class="btn brand big" onclick={start} disabled={starting}>{starting ? 'Starting…' : 'Go live'}</button>
    </div>
    <p class="muted note">You choose at the end whether to save the stream. Every viewer connects straight to you, so it suits a small audience.</p>
  </div>
{/if}

<style>
  .narrow { max-width: 760px; margin: 0 auto; padding: 22px 28px 48px; }
  h1 { margin: 4px 0 8px; font-size: 26px; font-weight: 900; letter-spacing: -0.7px; display: flex; align-items: center; gap: 10px; }
  h1 + p { margin: 0 0 18px; line-height: 1.55; }
  .stage { position: relative; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; background: #000; border: 1px solid var(--line); }
  .stage video { width: 100%; height: 100%; object-fit: contain; display: block; }
  .none { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; color: #8fa196; font-weight: 700; }
  .chips { display: flex; gap: 8px; margin: 14px 0 10px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; }
  .field { width: 100%; box-sizing: border-box; }
  .row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
  .note { font-size: 13px; margin-top: 16px; line-height: 1.55; }
  .err { color: #ef4444; font-weight: 600; font-size: 13.5px; margin: 8px 0 0; }
  .bar { height: 6px; border-radius: 99px; background: var(--bg3); overflow: hidden; margin: 14px 0; }
  .bar i { display: block; height: 100%; background: var(--brand); transition: width .2s; }

  .studio { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 26px; padding: 20px 28px 48px; align-items: start; }
  @media (max-width: 1150px) { .studio { grid-template-columns: 1fr; } }
  .tag, .time { position: absolute; top: 12px; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 900; color: #fff; }
  .tag { left: 12px; background: #ef4444; letter-spacing: .5px; }
  .time { left: 64px; background: rgba(0, 0, 0, .6); font-variant-numeric: tabular-nums; }
  .title { font-size: 20px; margin: 16px 0 10px; }
  .byline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .stats { flex: 1; display: flex; flex-wrap: wrap; gap: 16px; color: var(--muted); font-weight: 700; }
  .stats span { display: inline-flex; align-items: center; gap: 6px; }
  .stats b { color: var(--text); }
  .empty { display: grid; gap: 6px; justify-items: center; text-align: center; padding: 60px 20px; }
</style>
