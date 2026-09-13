<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { clock } from '../lib/format';
  import { popOut } from '../lib/native';

  let {
    src, postId, start = 0, autoplay = true, mini = false, vertical = false,
  }: { src: string; postId: string; start?: number; autoplay?: boolean; mini?: boolean; vertical?: boolean } = $props();

  let video: HTMLVideoElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let paused = $state(true);
  let time = $state(0);
  let duration = $state(0);
  let buffered = $state(0);
  let volume = $state(1);
  let muted = $state(false);
  let rate = $state(1);
  let idle = $state(false);
  let waiting = $state(false);
  let flash = $state('');
  let scrubbing = $state(false);
  let hoverAt = $state<number | null>(null);
  let speedsOpen = $state(false);

  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

  let idleTimer: ReturnType<typeof setTimeout>;
  let flashTimer: ReturnType<typeof setTimeout>;

  function wake() {
    idle = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!paused && !speedsOpen) idle = true; }, 2400);
  }
  function say(text: string) {
    flash = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash = ''), 650);
  }

  const toggle = () => { if (!video) return; video.paused ? video.play().catch(() => {}) : video.pause(); };
  function skip(by: number) {
    if (!video) return;
    video.currentTime = Math.min(duration || 0, Math.max(0, video.currentTime + by));
    say((by > 0 ? '+' : '−') + Math.abs(by) + 's');
  }
  function setRate(r: number) { if (video) video.playbackRate = r; rate = r; speedsOpen = false; say(r === 1 ? 'Normal speed' : r + '× speed'); }
  function fullscreen() { document.fullscreenElement ? document.exitFullscreen() : wrap?.requestFullscreen(); }

  function seekFromPointer(e: PointerEvent, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (video && duration) video.currentTime = f * duration;
  }

  // One click plays or pauses; a double click on either side skips, in the
  // middle goes full screen. The single click waits a moment for a second one.
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  function onVideoClick() {
    if (clickTimer) return;
    clickTimer = setTimeout(() => { clickTimer = null; toggle(); }, 220);
  }
  function onVideoDouble(e: MouseEvent) {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.32) skip(-10); else if (x > 0.68) skip(10); else fullscreen();
  }

  function keys(e: KeyboardEvent) {
    const t = (document.activeElement?.tagName || '').toLowerCase();
    if (t === 'input' || t === 'textarea') return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'arrowright') { e.preventDefault(); skip(5); }
    else if (k === 'arrowleft') { e.preventDefault(); skip(-5); }
    else if (k === 'l') skip(10);
    else if (k === 'j') skip(-10);
    else if (k === 'm' && video) { video.muted = !video.muted; say(video.muted ? 'Muted' : 'Sound on'); }
    else if (k === 'f') fullscreen();
    else if (k === 'p' && !mini) pop();
    else return;
    wake();
  }

  function pop() {
    if (!video) return;
    const at = video.currentTime;
    video.pause();
    popOut(postId, at);
  }

  onMount(() => {
    if (video && start) video.currentTime = start;
    if (autoplay) video?.play().catch(() => { /* the browser wants a click first */ });
    return () => { clearTimeout(idleTimer); clearTimeout(flashTimer); };
  });
</script>

<svelte:window onkeydown={keys} />

<div
  class="vp" class:idle class:mini class:vertical bind:this={wrap}
  onpointermove={wake} onpointerleave={() => { if (!paused) idle = true; }}
  role="region" aria-label="Video player"
>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={video} {src} playsinline preload="auto"
    bind:paused bind:currentTime={time} bind:duration bind:volume bind:muted
    onprogress={() => { if (video?.buffered.length && duration) buffered = video.buffered.end(video.buffered.length - 1) / duration; }}
    onwaiting={() => (waiting = true)} onplaying={() => (waiting = false)} oncanplay={() => (waiting = false)}
    onclick={onVideoClick} ondblclick={onVideoDouble}
  ></video>

  {#if waiting && !paused}<div class="wait"><div class="spinner"></div></div>{/if}
  {#if flash}<div class="flash">{flash}</div>{/if}

  <div class="skin">
    <button class="big" class:gone={!paused} onclick={toggle} aria-label="Play"><Icon name="play" size={34} /></button>

    <div class="ctl">
      <div
        class="seek" class:scrubbing
        onpointerdown={e => { scrubbing = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); seekFromPointer(e, e.currentTarget as HTMLElement); }}
        onpointermove={e => {
          const el = e.currentTarget as HTMLElement;
          const r = el.getBoundingClientRect();
          hoverAt = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          if (scrubbing) seekFromPointer(e, el);
        }}
        onpointerup={() => (scrubbing = false)}
        onpointerleave={() => (hoverAt = null)}
        role="slider" aria-label="Seek" aria-valuenow={Math.round(time)} tabindex="-1"
      >
        <div class="track">
          <div class="buf" style:width="{buffered * 100}%"></div>
          <div class="fill" style:width="{duration ? (time / duration) * 100 : 0}%"></div>
        </div>
        <div class="knob" style:left="{duration ? (time / duration) * 100 : 0}%"></div>
        {#if hoverAt !== null && duration}
          <div class="tip" style:left="{hoverAt * 100}%">{clock(hoverAt * duration)}</div>
        {/if}
      </div>

      <div class="row">
        <button class="c" onclick={toggle} aria-label={paused ? 'Play' : 'Pause'}><Icon name={paused ? 'play' : 'pause'} size={21} /></button>
        {#if !mini}
          <button class="c" onclick={() => skip(-10)} aria-label="Back 10 seconds">−10</button>
          <button class="c" onclick={() => skip(10)} aria-label="Forward 10 seconds">+10</button>
        {/if}
        <span class="vol">
          <button class="c" onclick={() => { if (video) video.muted = !video.muted; }} aria-label="Mute">
            <Icon name={muted || volume === 0 ? 'quiet' : 'loud'} size={21} />
          </button>
          {#if !mini}<input type="range" min="0" max="1" step="0.02" bind:value={volume} aria-label="Volume" />{/if}
        </span>
        <span class="time">{clock(time)}<i>/</i>{clock(duration)}</span>
        <span class="grow"></span>

        {#if !mini}
          <span class="speedwrap">
            <button class="c txt" class:lit={rate !== 1} onclick={() => (speedsOpen = !speedsOpen)}>{rate === 1 ? '1×' : rate + '×'}</button>
            {#if speedsOpen}
              <div class="speeds">
                {#each RATES as r}
                  <button class:on={r === rate} onclick={() => setRate(r)}>{r === 1 ? 'Normal' : r + '×'}</button>
                {/each}
              </div>
            {/if}
          </span>
          <button class="c" onclick={pop} title="Mini player (P)" aria-label="Mini player"><Icon name="popout" size={20} /></button>
        {/if}
        <button class="c" onclick={fullscreen} aria-label="Full screen"><Icon name="full" size={20} /></button>
      </div>
    </div>
  </div>
</div>

<style>
  .vp { position: relative; background: #000; border-radius: var(--radius); overflow: hidden; }
  .vp.mini { border-radius: 0; height: 100%; }
  video { width: 100%; display: block; aspect-ratio: 16 / 9; max-height: 74vh; object-fit: contain; background: #000; cursor: pointer; }
  .vertical video { aspect-ratio: 9 / 16; max-height: 82vh; }
  .mini video { height: 100%; max-height: none; aspect-ratio: auto; }
  .idle, .idle video { cursor: none; }

  .skin { position: absolute; inset: 0; pointer-events: none; transition: opacity .25s; background: linear-gradient(transparent 60%, rgba(0,0,0,.7)); }
  .skin > * { pointer-events: auto; }
  .idle .skin { opacity: 0; }

  .big {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 74px; height: 74px;
    border-radius: 99px; border: 0; color: #fff; display: grid; place-items: center;
    background: rgba(10, 14, 12, .55); backdrop-filter: blur(16px);
    box-shadow: 0 16px 44px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.14);
    transition: transform .22s cubic-bezier(.2, 1.4, .4, 1), opacity .2s;
  }
  .big:hover { transform: translate(-50%, -50%) scale(1.07); }
  .big.gone { opacity: 0; transform: translate(-50%, -50%) scale(.7); pointer-events: none; }
  .mini .big { width: 54px; height: 54px; }

  .wait { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
  .wait .spinner { width: 40px; height: 40px; border-color: rgba(255,255,255,.25); border-top-color: #fff; }
  .flash {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 10px 18px; border-radius: 99px;
    background: rgba(10, 14, 12, .7); color: #fff; font-weight: 800; pointer-events: none; animation: fade .15s both;
  }

  .ctl { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 14px 8px; color: #fff; }
  .seek { position: relative; height: 18px; display: flex; align-items: center; cursor: pointer; }
  .track { position: relative; width: 100%; height: 4px; border-radius: 99px; background: rgba(255,255,255,.28); overflow: hidden; transition: height .12s; }
  .seek:hover .track, .scrubbing .track { height: 7px; }
  .buf { position: absolute; inset: 0 auto 0 0; background: rgba(255,255,255,.35); }
  .fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, var(--green), var(--sky)); }
  .knob {
    position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 99px; background: #fff;
    transform: translate(-50%, -50%) scale(0); transition: transform .12s; box-shadow: 0 2px 8px rgba(0,0,0,.5);
  }
  .seek:hover .knob, .scrubbing .knob { transform: translate(-50%, -50%) scale(1); }
  .tip {
    position: absolute; bottom: 20px; transform: translateX(-50%); padding: 3px 8px; border-radius: 7px;
    background: rgba(10, 14, 12, .88); font-size: 12px; font-weight: 700; pointer-events: none;
  }

  .row { display: flex; align-items: center; gap: 2px; }
  .c {
    min-width: 36px; height: 36px; padding: 0 6px; border: 0; border-radius: 99px; background: transparent;
    color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 12.5px; transition: background .12s;
  }
  .c:hover { background: rgba(255,255,255,.16); }
  .c.lit { color: var(--green); }
  .vol { display: flex; align-items: center; }
  .vol input { width: 0; opacity: 0; transition: width .2s, opacity .2s; accent-color: #fff; }
  .vol:hover input { width: 80px; opacity: 1; margin: 0 8px 0 2px; }
  .time { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; padding: 0 8px; }
  .time i { font-style: normal; opacity: .5; margin: 0 5px; }
  .grow { flex: 1; }
  .mini .ctl { padding: 0 8px 4px; }

  .speedwrap { position: relative; }
  .speeds {
    position: absolute; right: 0; bottom: 44px; min-width: 140px; padding: 6px; border-radius: 12px;
    background: rgba(14, 18, 16, .95); border: 1px solid rgba(255,255,255,.12); animation: rise .14s both;
  }
  .speeds button { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px; background: none; color: #fff; font-weight: 700; }
  .speeds button:hover { background: rgba(255,255,255,.14); }
  .speeds button.on { color: var(--green); }
</style>
