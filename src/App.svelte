<script lang="ts">
  import TitleBar from './components/TitleBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Sheet from './components/Sheet.svelte';
  import Mark from './components/Mark.svelte';
  import SignIn from './pages/SignIn.svelte';
  import PickName from './pages/PickName.svelte';
  import Home from './pages/Home.svelte';
  import Watch from './pages/Watch.svelte';
  import Shorts from './pages/Shorts.svelte';
  import You from './pages/You.svelte';
  import Plus from './pages/Plus.svelte';
  import Compose from './pages/Compose.svelte';
  import Mini from './pages/Mini.svelte';
  import Live from './pages/Live.svelte';
  import GoLive from './pages/GoLive.svelte';
  import Stream from './pages/Stream.svelte';
  import User from './pages/User.svelte';
  import Following from './pages/Following.svelte';
  import { studio } from './lib/social.svelte';
  import { elapsed } from './lib/live.js';
  import { compact } from './lib/format';
  import WindowControls from './components/WindowControls.svelte';
  import { session, startSession } from './lib/state.svelte';
  import { route, back } from './lib/router.svelte';
  import { inTauri } from './lib/native';
  import { frame } from './lib/frame.svelte';

  startSession();

  // The sidebar folds to an icon rail on a narrow window; the menu button
  // flips it by hand, and the choice sticks.
  let width = $state(window.innerWidth);
  let collapsed = $state(localStorage.getItem('codera.rail') === '1');
  const narrow = $derived(collapsed || width < 1100);

  function toggle() {
    collapsed = !narrow;
    try { localStorage.setItem('codera.rail', collapsed ? '1' : '0'); } catch { /* fine */ }
  }

  let main: HTMLElement | undefined = $state();
  // A new page starts at its top, like turning a page.
  $effect(() => { route.name; route.arg; main?.scrollTo({ top: 0 }); });

  const needsName = $derived(session.user && session.profileReady && !session.profile.username);

  // The window has no system title bar, so screens without Codera's own bar
  // (loading, sign in, choosing a name) keep a strip along the top to move the window by.
  const mac = inTauri && navigator.userAgent.includes('Mac');
  const inShell = $derived(!!(session.ready && session.user && session.profileReady && !needsName));

  // Mouse back / forward buttons, and Alt+Left, move through history.
  function mouse(e: MouseEvent) { if (e.button === 3) back(); if (e.button === 4) history.forward(); }
  function keys(e: KeyboardEvent) { if (e.altKey && e.key === 'ArrowLeft') back(); if (e.altKey && e.key === 'ArrowRight') history.forward(); }
</script>

<svelte:window bind:innerWidth={width} onmouseup={mouse} onkeydown={keys} />

{#if route.name === 'mini'}
  <Mini id={route.arg} start={Number(route.params.t) || 0} />
{:else if !session.ready || (session.user && !session.profileReady)}
  <div class="boot"><div class="drag" data-tauri-drag-region></div><div class="pulse"><Mark size={84} /></div></div>
{:else if !session.user}
  <SignIn />
{:else if needsName}
  <PickName />
{:else}
  <!-- In fullscreen on a Mac the whole app moves down with the menu bar as it slides in. -->
  <div class="shell" class:narrow style:padding-top={frame.push ? frame.push + 'px' : null}>
    <TitleBar onToggleSidebar={toggle} />
    <Sidebar {narrow} />
    <main bind:this={main}>
      {#key route.name + '/' + (route.name === 'shorts' ? '' : route.arg)}
        {#if route.name === 'watch'}<Watch id={route.arg} />
        {:else if route.name === 'shorts'}<Shorts id={route.arg} />
        {:else if route.name === 'you'}<You />
        {:else if route.name === 'plus'}<Plus />
        {:else if route.name === 'new'}<Compose kind={route.arg} />
        {:else if route.name === 'live'}<Live />
        {:else if route.name === 'golive'}<GoLive />
        {:else if route.name === 'stream'}<Stream id={route.arg} />
        {:else if route.name === 'u'}<User arg={route.arg} />
        {:else if route.name === 'followed'}<Following />
        {:else}<Home />
        {/if}
      {/key}
    </main>
  </div>
{/if}

{#if inTauri && !inShell && route.name !== 'mini'}<div class="topdrag" data-tauri-drag-region></div>{/if}
{#if route.name !== 'mini'}<WindowControls />{/if}

<!-- While streaming, a way back to the studio from anywhere in the app. -->
{#if studio.now && inShell && route.name !== 'golive'}
  <a class="on-air" href="#/golive"><span class="dot"></span><b>You’re live</b>
    <span>{(studio.tick, elapsed(Date.now() - studio.now.startedAt))} · {compact(studio.now.watching)} watching</span></a>
{/if}

<Sheet />

<style>
  .shell {
    height: 100%; box-sizing: border-box; display: grid;
    grid-template: var(--titlebar) 1fr / var(--sidebar) 1fr;
    grid-template-areas: 'bar bar' 'side main';
  }
  .shell.narrow { grid-template-columns: 72px 1fr; }
  .shell :global(.bar) { grid-area: bar; }
  .shell :global(.side) { grid-area: side; }
  main { grid-area: main; overflow-y: auto; overflow-x: hidden; min-width: 0; position: relative; scroll-behavior: auto; }

  .on-air {
    position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 60;
    display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 999px;
    background: #ef4444; color: #fff; font-size: 13.5px; font-weight: 700; box-shadow: 0 12px 34px rgba(239, 68, 68, .4);
  }
  .on-air span:last-child { opacity: .85; font-variant-numeric: tabular-nums; }
  .on-air .dot { width: 8px; height: 8px; border-radius: 99px; background: #fff; animation: blink 1.4s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: .35; } }
  .topdrag { position: fixed; inset: 0 0 auto; height: 32px; z-index: 40; }
  .boot { height: 100%; display: grid; place-items: center; position: relative; }
  .drag { position: absolute; inset: 0 0 auto; height: var(--titlebar); }
  .pulse { animation: breathe 1.6s ease-in-out infinite; }
  @keyframes breathe { 0%, 100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.06); opacity: 1; } }
</style>
