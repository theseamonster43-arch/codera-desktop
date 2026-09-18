<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { face } from '../lib/state.svelte';
  import { compact, ago } from '../lib/format';
  import { userHref, type Stream } from '../lib/social.svelte';
  import { go } from '../lib/router.svelte';

  /** A stream that is on air, in the same shape as a video's card. */
  let { stream, index = 0 }: { stream: Stream; index?: number } = $props();
  const who = $derived(face(stream));
</script>

<div class="card" style:--i={Math.min(index, 14)} role="link" tabindex="0"
  onclick={() => go('stream/' + stream.id)} onkeydown={e => e.key === 'Enter' && go('stream/' + stream.id)}>
  <div class="thumb">
    <div class="art"><Avatar name={who.name} photo={who.photo} size={64} /></div>
    <span class="badge live">LIVE</span>
    <span class="badge count">{compact(stream.watching || 0)} watching</span>
  </div>
  <div class="meta">
    <Avatar name={who.name} photo={who.photo} size={34} />
    <div class="words">
      <h3>{stream.title}</h3>
      <a class="muted who" href={userHref(stream)} onclick={e => e.stopPropagation()}>{who.name}</a>
      <div class="muted">Started {ago(stream.startedAt)}</div>
    </div>
  </div>
</div>

<style>
  .card { cursor: pointer; display: flex; flex-direction: column; min-width: 0; transition: transform .2s cubic-bezier(.2, .9, .3, 1); }
  .card:hover { transform: translateY(-3px); }
  .thumb {
    position: relative; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; display: grid; place-items: center;
    background:
      radial-gradient(60% 90% at 25% 20%, rgba(34, 197, 94, 0.45), transparent 70%),
      radial-gradient(60% 90% at 80% 90%, rgba(59, 130, 246, 0.45), transparent 70%),
      #07100b;
  }
  .art :global(.avatar), .art :global(img), .art > :global(*) { box-shadow: 0 0 0 3px rgba(239, 68, 68, .9), 0 0 32px rgba(239, 68, 68, .45); border-radius: 99px; }
  .badge { position: absolute; bottom: 8px; padding: 2px 6px; border-radius: 6px; font-size: 11.5px; font-weight: 800; color: #fff; }
  .badge.live { left: 8px; background: #ef4444; letter-spacing: .4px; }
  .badge.count { right: 8px; background: rgba(0, 0, 0, .7); }
  .meta { display: flex; gap: 11px; padding: 11px 2px 0; }
  .words { min-width: 0; display: grid; gap: 2px; }
  h3 { margin: 0 0 2px; font-size: 15px; font-weight: 800; line-height: 1.32; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .who { font-weight: 600; font-size: 13px; }
  .who:hover { color: var(--text); text-decoration: underline; }
  .muted { font-size: 13px; }
</style>
