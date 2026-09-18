<script lang="ts">
  import Icon from './Icon.svelte';
  import { route } from '../lib/router.svelte';
  import { session } from '../lib/state.svelte';
  import { inTauri } from '../lib/native';

  // The installed version, so it is easy to tell which build is running.
  let version = $state('');
  if (inTauri) import('@tauri-apps/api/app').then(a => a.getVersion()).then(v => (version = v)).catch(() => {});

  let { narrow = false }: { narrow?: boolean } = $props();

  const items = [
    { to: '', name: 'home', icon: 'home', label: 'Home' },
    { to: 'shorts', name: 'shorts', icon: 'shorts', label: 'Shorts' },
    { to: 'live', name: 'live', icon: 'live', label: 'Live' },
    { to: 'followed', name: 'followed', icon: 'followed', label: 'Following' },
    { to: 'you', name: 'you', icon: 'person', label: 'You' },
  ];

  const mine = $derived(session.posts.filter(p => p.uid === session.user?.uid));
  const on = (name: string) => route.name === name || (name === 'home' && ['search', 'watch'].includes(route.name))
    || (name === 'live' && ['golive', 'stream'].includes(route.name));
</script>

<nav class="side" class:narrow>
  {#each items as it}
    <a class="item" class:on={on(it.name)} href="#/{it.to}" title={it.label}>
      <Icon name={on(it.name) ? it.icon + 'On' : it.icon} size={21} />
      <span>{it.label}</span>
    </a>
  {/each}

  <a class="item" class:on={route.name === 'plus'} href="#/plus" title="Codera Plus">
    <Icon name="sparkle" size={21} />
    <span>Codera Plus</span>
    {#if session.plus.active && !narrow}<i class="dot"></i>{/if}
  </a>

  {#if !narrow}
    <div class="sep"></div>
    <div class="label">Yours</div>
    <div class="stats">
      <div><b>{mine.filter(p => p.type === 'post').length}</b><span>posts</span></div>
      <div><b>{mine.filter(p => p.type === 'short').length}</b><span>shorts</span></div>
      <div><b>{mine.filter(p => p.type === 'video').length}</b><span>videos</span></div>
    </div>

    <div class="grow"></div>
    <div class="foot muted">
      Codera for desktop{#if version} {version}{/if}<br />Shortcuts: <kbd>Ctrl K</kbd> search · <kbd>Space</kbd> play
    </div>
  {/if}
</nav>

<style>
  .side {
    width: var(--sidebar); flex: none; display: flex; flex-direction: column; gap: 2px;
    padding: 12px 10px; border-right: 1px solid var(--line); overflow-y: auto;
    transition: width .18s cubic-bezier(.2, .9, .3, 1);
  }
  .side.narrow { width: 72px; align-items: center; }
  .item {
    display: flex; align-items: center; gap: 14px; height: 40px; padding: 0 12px; border-radius: 10px;
    font-weight: 600; color: var(--text); position: relative; transition: background .12s; width: 100%;
  }
  .narrow .item { justify-content: center; padding: 0; width: 48px; }
  .narrow .item span { display: none; }
  .item:hover { background: var(--hover); }
  .item.on { background: var(--bg3); font-weight: 800; }
  .item.on :global(.i) { color: var(--blue); }
  .dot { width: 7px; height: 7px; border-radius: 99px; background: var(--brand); margin-left: auto; }

  .sep { height: 1px; background: var(--line); margin: 12px 4px; }
  .label { padding: 0 12px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 0 6px; }
  .stats div { display: grid; justify-items: center; padding: 10px 0; border-radius: 10px; background: var(--bg2); border: 1px solid var(--line); }
  .stats b { font-size: 16px; font-weight: 800; }
  .stats span { font-size: 11px; color: var(--muted); font-weight: 600; }
  .grow { flex: 1; }
  .foot { font-size: 11.5px; line-height: 1.8; padding: 12px; }
  kbd { font: 700 10px 'Scoutie Sans', sans-serif; padding: 1px 5px; border: 1px solid var(--line); border-radius: 5px; }
</style>
