<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import ChatPanel from '../components/ChatPanel.svelte';
  import {
    studio, goLive, endLive, saveStream, dropStream, watchStreamDoc, switchSource, popOutChat,
    type Stream, type Source, type Picks,
  } from '../lib/social.svelte';
  import { capture, canStream, devices, elapsed } from '../lib/live.js';
  import { compact, human } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { say } from '../lib/sheet.svelte';

  /**
   * Going live: choose the camera or the screen, name the stream, go. While
   * live, this page is the studio: the preview, the counts, the chat and the
   * button that ends it, followed by the question of whether to keep it.
   */
  let source = $state<Source>('camera');
  // The camera and microphone to use; '' is the system's default. OBS's
  // virtual camera shows up here as a camera once OBS has started it.
  let picks = $state<Picks>({ cam: '', mic: '' });
  let cams = $state<{ id: string; label: string }[]>([]);
  let mics = $state<{ id: string; label: string }[]>([]);
  let switching = $state(false);
  let switchErr = $state('');

  // Device names only appear once a camera or microphone has been allowed, so
  // the lists are read again whenever something is picked or plugged in.
  async function listDevices() {
    const d = await devices().catch(() => ({ cams: [], mics: [] }));
    cams = d.cams;
    mics = d.mics;
  }
  $effect(() => {
    listDevices();
    navigator.mediaDevices?.addEventListener('devicechange', listDevices);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', listDevices);
  });
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
    if (preview) preview.srcObject = live ? live.mix.stream : media;
  });

  $effect(() => {
    if (!live) return;
    return watchStreamDoc(live.id, s => (doc = s));
  });

  // Anything picked but never taken live is let go when the page is left.
  $effect(() => () => { if (media && !handedOver) media.getTracks().forEach(t => t.stop()); });

  async function pick(src: Source) {
    source = src;
    err = '';
    try {
      const m = await capture(src, picks);
      if (media && media !== m) media.getTracks().forEach(t => t.stop());
      media = m;
      listDevices();
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
      await goLive(title, media, source, { ...picks });
    } catch (e) {
      handedOver = false;
      err = human(e);
    }
    starting = false;
  }

  /** Mid-stream: put another source on air. Viewers and the recording carry straight on. */
  async function change(kind: Source, p: Partial<Picks> = {}) {
    if (switching) return;
    switching = true;
    switchErr = '';
    try {
      await switchSource(kind, p);
      listDevices();
    } catch {
      switchErr = kind === 'screen'
        ? 'Screen sharing was cancelled. You’re still showing the same thing as before.'
        : 'That camera or microphone couldn’t be used. It may be busy in another app.';
    }
    switching = false;
  }

  async function end() {
    const out = await endLive();
    media = null;
    if (!out) return;
    if (!out.blob) { dropStream(out.id); say('Stream ended.'); go(''); return; }
    ended = { id: out.id, title: out.title, blob: out.blob, secs: out.secs };
  }

  async function keep() {
    if (!ended) return;
    saving = 0;
    try {
      await saveStream(ended.id, ended.title, ended.blob, ended.secs, f => (saving = f));
      ended = null;
      say('Saved. It’s on your page and in the feed.');
      go('');
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
    go('');
  }
</script>

{#if ended}
  <div class="page narrow">
    <h1><Icon name="live" size={24} /> Save this stream?</h1>
    <p class="muted">“{ended.title}” ran for {elapsed(ended.secs * 1000)}. Saved streams go on your page and into people’s feeds, where they can watch them back. Nothing has been uploaded yet.</p>
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
        <button class="btn" onclick={() => popOutChat(live.id)}><Icon name="popout" size={17} />{studio.chatOpen ? 'Chat is open' : 'Pop out chat'}</button>
        <button class="btn danger" onclick={end}>End stream</button>
      </div>
      <div class="switcher">
        <div class="head"><b>On air</b><span class="muted">Switch what you’re showing, or to another camera or microphone. Viewers don’t get cut off.</span></div>
        <div class="chips">
          <button class="chip" class:on={live.source === 'camera'} disabled={switching} onclick={() => change('camera')}><Icon name="camera" size={16} />Camera</button>
          <button class="chip" class:on={live.source === 'screen'} disabled={switching} onclick={() => change('screen')}><Icon name="screen" size={16} />Screen</button>
        </div>
        <div class="devices">
          <label><Icon name="camera" size={17} />
            <select class="field sel" value={live.picks.cam} disabled={switching} onchange={e => change('camera', { cam: e.currentTarget.value })}>
              <option value="">Default camera</option>
              {#each cams as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
            </select></label>
          <label><Icon name="mic" size={17} />
            <select class="field sel" value={live.picks.mic} disabled={switching} onchange={e => change(live.source, { mic: e.currentTarget.value })}>
              <option value="">Default microphone</option>
              {#each mics as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
            </select></label>
        </div>
        {#if switchErr}<p class="err">{switchErr}</p>{/if}
      </div>
      <p class="muted note">Viewers find you at the top of Home while you’re on air, and everyone who follows you sees a red ring on your picture. Only you see this preview.</p>
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
    <div class="devices">
      <label><Icon name="camera" size={17} />
        <select class="field sel" bind:value={picks.cam} onchange={() => source === 'camera' && pick('camera')}>
          <option value="">Default camera</option>
          {#each cams as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
        </select></label>
      <label><Icon name="mic" size={17} />
        <select class="field sel" bind:value={picks.mic} onchange={() => pick(source)}>
          <option value="">Default microphone</option>
          {#each mics as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
        </select></label>
    </div>
    <input class="field" bind:value={title} maxlength="120" placeholder="What are you streaming? e.g. Building a Python bot"
      onkeydown={e => e.key === 'Enter' && start()} />
    {#if err}<p class="err">{err}</p>{/if}
    <div class="row">
      <a class="btn" href="#/">Cancel</a>
      <button class="btn brand big" onclick={start} disabled={starting}>{starting ? 'Starting…' : 'Go live'}</button>
    </div>
    <p class="muted note">You choose at the end whether to save the stream. Every viewer connects straight to you, so it suits a small audience.
      Using OBS? Start its virtual camera and pick “OBS Virtual Camera” above. To let viewers tip you, <a href="#/you">set up payouts</a> on your page.</p>
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
  .stats span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  /* On a narrow window the counts keep a line of their own, the buttons another. */
  @media (max-width: 760px) { .stats { flex-basis: 100%; } .byline .btn { flex: 1; justify-content: center; } }
  .stats b { color: var(--text); }
  .devices { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 0 0 10px; }
  .devices label { position: relative; display: block; }
  .devices label :global(svg) { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
  .sel { width: 100%; box-sizing: border-box; padding-left: 38px; padding-right: 34px; appearance: none; cursor: pointer; text-overflow: ellipsis;
    background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
    background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
  .switcher { margin-top: 18px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg2); }
  .switcher .head { display: grid; gap: 2px; }
  .switcher .head .muted { font-size: 13px; }
  .switcher .chips { margin: 12px 0 10px; }
  .switcher .devices { margin: 0; }
  .note a { color: var(--blue, #3b82f6); font-weight: 600; }
  .byline .btn { display: inline-flex; align-items: center; gap: 6px; }
  .empty { display: grid; gap: 6px; justify-items: center; text-align: center; padding: 60px 20px; }
</style>
