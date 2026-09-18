<script lang="ts">
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import { face, session } from '../lib/state.svelte';
  import { watchChat, sendChat, deleteChat, userHref, type ChatMessage } from '../lib/social.svelte';
  import { say } from '../lib/sheet.svelte';
  import { human } from '../lib/format';

  /** The chat beside a stream, for the streamer and for everyone watching. */
  // fill: the whole of a window of its own (the pop-out chat) rather than a panel.
  let { streamId, hostUid, fill = false }: { streamId: string; hostUid: string; fill?: boolean } = $props();

  let messages = $state<ChatMessage[]>([]);
  let ready = $state(false);
  let draft = $state('');
  let list: HTMLDivElement | undefined = $state();

  $effect(() => {
    const stop = watchChat(streamId, m => {
      const stick = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      messages = m;
      ready = true;
      if (stick) requestAnimationFrame(() => list && (list.scrollTop = list.scrollHeight));
    });
    return stop;
  });

  function send(e: Event) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    draft = '';
    sendChat(streamId, text).catch(err => { draft = text; say(human(err)); });
  }

  const me = $derived(session.user?.uid);
</script>

<aside class="chat" class:fill>
  {#if !fill}<div class="head">Live chat</div>{/if}
  <div class="list" bind:this={list}>
    {#if !ready}
      <div class="empty"><div class="spinner"></div></div>
    {:else}
      {#each messages as m (m.id)}
        {@const who = face(m)}
        <div class="msg" class:tip={!!m.tip} class:host={m.uid === hostUid}>
          <Avatar name={who.name} photo={who.photo} size={26} />
          <div class="body">
            <a href={userHref(m)} class="name">{who.name}</a>
            {#if m.uid === hostUid}<span class="host-tag">Streamer</span>{/if}
            {#if m.tip}<span class="amt"><Icon name="tip" size={14} />${(m.tip / 100).toFixed(2)}</span>{/if}
            {#if m.text}<span class="text">{m.text}</span>{/if}
          </div>
          {#if !m.tip && (m.uid === me || me === hostUid)}
            <button class="x" onclick={() => deleteChat(streamId, m.id).catch(err => say(human(err)))} aria-label="Delete">×</button>
          {/if}
        </div>
      {:else}
        <div class="empty muted">No messages yet. Say hello.</div>
      {/each}
    {/if}
  </div>
  <form class="send" onsubmit={send}>
    <input class="field" bind:value={draft} maxlength="300" placeholder="Say something" autocomplete="off" />
    <button class="icon-btn" aria-label="Send" disabled={!draft.trim()}><Icon name="send" size={18} /></button>
  </form>
</aside>

<style>
  .chat {
    display: grid; grid-template-rows: auto 1fr auto; height: min(78vh, 720px); position: sticky; top: 12px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg2); overflow: hidden;
  }
  .chat.fill { height: auto; min-height: 0; position: static; border: 0; border-radius: 0; grid-template-rows: 1fr auto; }
  .head { padding: 12px 16px; font-weight: 800; border-bottom: 1px solid var(--line); }
  .list { overflow-y: auto; padding: 8px 6px 8px 12px; display: grid; align-content: start; gap: 2px; }
  .empty { padding: 18px 4px; text-align: center; font-size: 13.5px; display: grid; place-items: center; }
  .msg { display: flex; gap: 9px; align-items: flex-start; padding: 6px; border-radius: 10px; font-size: 13.8px; line-height: 1.45; }
  .body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .name { margin-right: 6px; font-size: 13px; font-weight: 700; color: var(--muted); }
  .name:hover { text-decoration: underline; }
  .host .name { color: var(--green, #22c55e); }
  .host-tag { font-size: 10px; font-weight: 900; letter-spacing: .4px; text-transform: uppercase; color: #22c55e; margin-right: 6px; }
  .amt { display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; font-weight: 900; color: #f59e0b; }
  .msg.tip { background: linear-gradient(135deg, rgba(245, 158, 11, .22), rgba(239, 68, 68, .14)); border: 1px solid rgba(245, 158, 11, .45); margin: 4px 0; }
  .x { border: 0; background: none; color: var(--muted); font-size: 16px; line-height: 1; opacity: 0; padding: 2px 4px; }
  .msg:hover .x { opacity: 1; }
  .send { display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--line); }
  .send .field { flex: 1; min-width: 0; height: 40px; border-radius: 999px; }
  @media (max-width: 1150px) { .chat { position: static; height: 460px; } }
</style>
