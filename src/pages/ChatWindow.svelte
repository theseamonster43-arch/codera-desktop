<script lang="ts">
  import ChatPanel from '../components/ChatPanel.svelte';
  import WindowControls from '../components/WindowControls.svelte';
  import { session } from '../lib/state.svelte';
  import { watchStreamDoc, onAir, type Stream } from '../lib/social.svelte';
  import { inTauri } from '../lib/native';

  /**
   * A stream's chat alone in its own window, for a streamer to keep beside OBS
   * or a game. It shares the main window's sign-in.
   */
  let { id }: { id: string } = $props();

  let s = $state<Stream | null>(null);
  let loaded = $state(false);
  const framed = inTauri && !navigator.userAgent.includes('Mac');

  $effect(() => {
    if (!session.user) return;
    return watchStreamDoc(id, d => { s = d; loaded = true; });
  });

  $effect(() => { document.title = s ? `Chat — ${s.title}` : 'Codera — stream chat'; });
</script>

<div class="win" class:framed>
  {#if framed}
    <div class="grip" data-tauri-drag-region><span data-tauri-drag-region>{s?.title || 'Stream chat'}</span></div>
    <WindowControls compact />
  {/if}
  {#if !session.ready || (session.user && !loaded)}
    <div class="wait"><div class="spinner"></div></div>
  {:else if !session.user}
    <div class="wait muted">Sign in to Codera in the main window.</div>
  {:else if !s}
    <div class="wait muted">This stream isn’t there any more.</div>
  {:else}
    <div class="top">
      {#if onAir(s)}<span class="tag">LIVE</span>{:else}<span class="tag off">ENDED</span>{/if}
      <b>{s.title}</b>
    </div>
    <ChatPanel streamId={s.id} hostUid={s.uid} fill />
  {/if}
</div>

<style>
  .win { height: 100%; display: grid; grid-template-rows: auto 1fr; background: var(--bg); }
  .win.framed { grid-template-rows: 32px auto 1fr; }
  .grip {
    display: flex; align-items: center; padding: 0 150px 0 12px; font-size: 12.5px; font-weight: 700;
    background: linear-gradient(90deg, rgba(34,197,94,.18), rgba(59,130,246,.18)), var(--bg2);
  }
  .grip span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .top { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--line); min-width: 0; }
  .top b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { flex: none; padding: 2px 7px; border-radius: 6px; font-size: 11.5px; font-weight: 900; color: #fff; background: #ef4444; letter-spacing: .5px; }
  .tag.off { background: var(--bg3); color: var(--muted); }
  .wait { display: grid; place-items: center; text-align: center; padding: 20px; grid-row: -2 / -1; }
</style>
