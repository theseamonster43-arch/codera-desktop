<script lang="ts">
  import Icon from './Icon.svelte';
  import Mark from './Mark.svelte';
  import Avatar from './Avatar.svelte';
  import { inTauri, toggleMaximize } from '../lib/native';
  import { session, myName, myPhoto } from '../lib/state.svelte';
  import { go, route } from '../lib/router.svelte';
  import { signOut } from 'firebase/auth';
  import { auth } from '../lib/firebase';
  import { frame, toggleFullscreen, showLights } from '../lib/frame.svelte';

  let { onToggleSidebar }: { onToggleSidebar: () => void } = $props();

  let search = $state(route.name === 'search' ? route.arg : '');
  let searchEl: HTMLInputElement | undefined = $state();
  let menuOpen = $state(false);

  // On a Mac the system's own red, yellow and green buttons sit over the left end of
  // this bar; on Windows the minimise, maximise and close buttons sit over the right end.
  // The bar leaves room for whichever it has.
  // In fullscreen on a Mac the lights hide, the bar closes the gap they leave, and
  // pointing at the bar brings them back.
  const mac = inTauri && navigator.userAgent.includes('Mac');
  const win = inTauri && !mac;
  let peek = $state(false);

  function point(over: boolean) {
    if (!mac || !frame.fullscreen) return;
    peek = over;
    showLights(over);
  }
  $effect(() => { if (!frame.fullscreen) peek = false; });

  // Ctrl+K from anywhere puts you in the search box, as in most desktop apps.
  function keys(e: KeyboardEvent) {
    // Ctrl+Cmd+F: fullscreen, as in every Mac app.
    if (mac && e.ctrlKey && e.metaKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchEl?.focus();
      searchEl?.select();
    }
  }

  function submit(e: Event) {
    e.preventDefault();
    const q = search.trim();
    go(q ? 'search/' + encodeURIComponent(q) : '');
    searchEl?.blur();
  }
</script>

<svelte:window onkeydown={keys} onclick={() => (menuOpen = false)} />

<!-- The bar itself is the window's handle: drag it to move, double-click to
     maximise (on Windows; the green button does that on a Mac). The controls
     inside it opt out of dragging by being buttons. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<header
  class="bar" class:mac class:win class:fs={mac && frame.fullscreen} class:peek data-tauri-drag-region
  ondblclick={e => win && e.target === e.currentTarget && toggleMaximize()}
  onmouseenter={() => point(true)} onmouseleave={() => point(false)}
>
  <div class="left" data-tauri-drag-region>
    <button class="icon-btn" onclick={onToggleSidebar} aria-label="Menu" title="Menu">
      <svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
    <a class="brand" href="#/" aria-label="Codera home">
      <Mark size={24} />
      <b>Codera</b>
      {#if session.plus.active}<span class="plus-tag">PLUS</span>{/if}
    </a>
  </div>

  <form class="search" onsubmit={submit} role="search">
    <Icon name="search" size={17} />
    <input bind:this={searchEl} bind:value={search} placeholder="Search Codera" spellcheck="false" />
    <kbd>Ctrl K</kbd>
  </form>

  <div class="right" data-tauri-drag-region>
    <button class="btn create" onclick={() => go('new/post')}>
      <Icon name="plus" size={17} />
      Create
    </button>

    <div class="me">
      <button class="avbtn" onclick={e => { e.stopPropagation(); menuOpen = !menuOpen; }} aria-label="Account">
        <Avatar name={myName()} photo={myPhoto()} size={30} />
      </button>
      {#if menuOpen}
        <div class="menu" role="menu">
          <div class="who">
            <b>@{myName()}</b>
            {#if session.plus.active}<span class="muted">Codera Plus</span>{/if}
          </div>
          <button onclick={() => go('you')}><Icon name="person" size={17} /> Your page</button>
          <button onclick={() => go('plus')}><Icon name="sparkle" size={17} /> Codera Plus</button>
          <button class="danger" onclick={() => signOut(auth)}>Sign out</button>
        </div>
      {/if}
    </div>

  </div>
</header>

<style>
  .bar {
    height: var(--titlebar); flex: none; display: grid; grid-template-columns: 1fr minmax(260px, 560px) 1fr;
    align-items: center; gap: 12px; padding-left: 8px; border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(16px);
    position: relative; z-index: 30;
  }
  .left, .right { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .right { justify-content: flex-end; }
  .brand { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 8px; }
  .brand b { font-size: 16.5px; font-weight: 900; letter-spacing: -0.5px; }

  .search {
    display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px 0 11px;
    border-radius: 10px; border: 1px solid var(--line); background: var(--bg2); color: var(--muted);
    transition: border-color .12s;
  }
  .search:focus-within { border-color: var(--blue); color: var(--text); }
  .search input { flex: 1; min-width: 0; border: 0; background: none; outline: none; font-size: 13.5px; }
  kbd {
    font: 700 10.5px 'Scoutie Sans', sans-serif; color: var(--muted); padding: 2px 6px;
    border: 1px solid var(--line); border-radius: 6px; background: var(--bg3);
  }

  .create { height: 32px; padding: 0 12px; border-radius: 9px; font-size: 13px; }
  .me { position: relative; margin: 0 6px 0 2px; }
  .avbtn { border: 0; background: none; padding: 0; border-radius: 999px; display: grid; }

  .menu {
    position: absolute; right: 0; top: 40px; min-width: 210px; padding: 6px; border-radius: 14px;
    background: var(--bg2); border: 1px solid var(--line); box-shadow: 0 18px 50px rgba(0,0,0,.35);
    animation: rise .16s ease both;
  }
  .menu .who { padding: 8px 10px 10px; border-bottom: 1px solid var(--line); margin-bottom: 6px; display: grid; }
  .menu button {
    width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 0;
    border-radius: 9px; background: none; font-weight: 700; text-align: left;
  }
  .menu button:hover { background: var(--hover); }
  .menu .danger { color: var(--red); }

  .bar.mac { padding-left: 84px; transition: padding-left .18s cubic-bezier(.2, .9, .3, 1); }
  .bar.mac.fs { padding-left: 12px; }
  .bar.mac.fs.peek { padding-left: 84px; }
  .bar.win { padding-right: 138px; }
</style>
