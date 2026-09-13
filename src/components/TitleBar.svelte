<script lang="ts">
  import Icon from './Icon.svelte';
  import Mark from './Mark.svelte';
  import Avatar from './Avatar.svelte';
  import { inTauri, minimize, toggleMaximize, closeWindow } from '../lib/native';
  import { session, myName, myPhoto } from '../lib/state.svelte';
  import { go, route } from '../lib/router.svelte';
  import { signOut } from 'firebase/auth';
  import { auth } from '../lib/firebase';

  let { onToggleSidebar }: { onToggleSidebar: () => void } = $props();

  let search = $state(route.name === 'search' ? route.arg : '');
  let searchEl: HTMLInputElement | undefined = $state();
  let menuOpen = $state(false);

  // A Mac gets its own red, yellow and green buttons on the left; Windows gets them on the right.
  const mac = navigator.userAgent.includes('Mac');

  // Ctrl+K from anywhere puts you in the search box, as in most desktop apps.
  function keys(e: KeyboardEvent) {
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
     maximise. The controls inside it opt out of dragging by being buttons. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<header class="bar" data-tauri-drag-region ondblclick={e => e.target === e.currentTarget && toggleMaximize()}>
  <div class="left" data-tauri-drag-region>
    {#if inTauri && mac}
      <div class="lights">
        <button class="red" onclick={closeWindow} aria-label="Close"></button>
        <button class="yellow" onclick={minimize} aria-label="Minimise"></button>
        <button class="green" onclick={toggleMaximize} aria-label="Zoom"></button>
      </div>
    {/if}
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

    {#if inTauri && !mac}
      <div class="win">
        <button onclick={minimize} aria-label="Minimise"><Icon name="winMin" size={16} /></button>
        <button onclick={toggleMaximize} aria-label="Maximise"><Icon name="winMax" size={16} /></button>
        <button class="close" onclick={closeWindow} aria-label="Close"><Icon name="winClose" size={16} /></button>
      </div>
    {/if}
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

  .lights { display: flex; gap: 8px; padding: 0 10px 0 6px; }
  .lights button { width: 12px; height: 12px; border-radius: 99px; border: 0; padding: 0; }
  .lights .red { background: #ff5f57; }
  .lights .yellow { background: #febc2e; }
  .lights .green { background: #28c840; }
  .lights:hover button { filter: brightness(.9); }

  .win { display: flex; height: var(--titlebar); }
  .win button {
    width: 46px; height: 100%; border: 0; background: transparent; color: var(--text);
    display: grid; place-items: center; transition: background .1s;
  }
  .win button:hover { background: var(--hover); }
  .win .close:hover { background: #e81123; color: #fff; }
</style>
