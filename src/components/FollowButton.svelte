<script lang="ts">
  import { social, toggleFollow } from '../lib/social.svelte';
  import { session } from '../lib/state.svelte';
  import { say } from '../lib/sheet.svelte';
  import { human } from '../lib/format';

  /** Follow / Following, for anyone but yourself. Changes at once; the listener confirms. */
  let { uid }: { uid: string } = $props();
  const on = $derived(social.following.has(uid));
  const mine = $derived(session.user?.uid === uid);
</script>

{#if uid && !mine}
  <button class="btn follow" class:on onclick={e => { e.stopPropagation(); toggleFollow(uid).catch(err => say(human(err))); }}>
    {on ? 'Following' : 'Follow'}
  </button>
{/if}

<style>
  .follow { background: var(--text); color: var(--bg); border-color: transparent; }
  .follow:hover { filter: brightness(.92); }
  .follow.on { background: var(--bg2); color: var(--text); border-color: var(--line); }
</style>
