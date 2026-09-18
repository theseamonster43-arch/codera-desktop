<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import PostCard from '../components/PostCard.svelte';
  import StreamCard from '../components/StreamCard.svelte';
  import Icon from '../components/Icon.svelte';
  import { faces, learnFaces, session } from '../lib/state.svelte';
  import { social, onAir, userHref } from '../lib/social.svelte';

  /** The people you follow: who is live, and what they posted lately. */
  const people = $derived([...social.following]);
  $effect(() => { learnFaces(people.map(uid => ({ uid }))); });
  const live = $derived(social.streams.filter(s => social.following.has(s.uid) && onAir(s)));
  const latest = $derived(session.posts.filter(p => social.following.has(p.uid)));
</script>

<div class="page wrap">
  <h1>Following</h1>
  {#if !people.length}
    <div class="empty">
      <Icon name="followed" size={34} />
      <b>Not following anyone yet</b>
      <span class="muted">Open someone’s page from their name on any post and press Follow. Their new videos and streams land here.</span>
    </div>
  {:else}
    <div class="people">
      {#each people as uid (uid)}
        {@const f = faces[uid] || {}}
        {@const on = live.find(s => s.uid === uid)}
        <a class="person" class:live={!!on} href={on ? '#/stream/' + on.id : userHref({ uid })}>
          <Avatar name={f.username || '…'} photo={f.photoUrl || null} size={56} />
          <span>{f.username || '…'}</span>
          {#if on}<em>LIVE</em>{/if}
        </a>
      {/each}
    </div>
    {#if live.length}
      <h2><Icon name="live" size={18} /> Live now</h2>
      <div class="grid stagger">{#each live as s, i (s.id)}<StreamCard stream={s} index={i} />{/each}</div>
    {/if}
    <h2>Latest from people you follow</h2>
    {#if latest.length}
      <div class="grid stagger">{#each latest as post, i (post.id)}<PostCard {post} index={i} />{/each}</div>
    {:else}
      <p class="muted">When the people you follow post something, it shows up here.</p>
    {/if}
  {/if}
</div>

<style>
  .wrap { padding: 20px 28px 48px; }
  h1 { margin: 4px 0 16px; font-size: 26px; font-weight: 900; letter-spacing: -0.7px; }
  h2 { margin: 26px 0 12px; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .people { display: flex; gap: 14px; overflow-x: auto; padding: 4px 2px 10px; }
  .person { display: grid; justify-items: center; gap: 6px; width: 84px; flex: none; font-size: 12.5px; font-weight: 700; position: relative; }
  .person span { max-width: 84px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .person.live :global(.avatar), .person.live > :global(:first-child) { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px #ef4444; border-radius: 99px; }
  .person em { position: absolute; top: 44px; font-style: normal; font-size: 9.5px; font-weight: 900; background: #ef4444; color: #fff; padding: 1px 6px; border-radius: 5px; }
  .grid { display: grid; gap: 26px 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .empty { display: grid; gap: 8px; justify-items: center; text-align: center; padding: 70px 20px; color: var(--muted); }
  .empty b { font-size: 17px; color: var(--text); }
  .empty span { max-width: 420px; }
</style>
