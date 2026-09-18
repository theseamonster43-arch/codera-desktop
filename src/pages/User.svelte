<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import PostCard from '../components/PostCard.svelte';
  import FollowButton from '../components/FollowButton.svelte';
  import { faces, session, type Kind, type Post } from '../lib/state.svelte';
  import { social, onAir, resolveUser, loadUser } from '../lib/social.svelte';
  import { compact, plural, human } from '../lib/format';
  import { go } from '../lib/router.svelte';

  /** Someone's page: their banner, name, followers, and everything they posted. */
  let { arg }: { arg: string } = $props();

  let uid = $state<string | null>(null);
  let data = $state<Awaited<ReturnType<typeof loadUser>> | null>(null);
  let err = $state('');
  let filter = $state<'all' | Kind>('all');
  let followedAtLoad = false;

  $effect(() => {
    const want = arg;
    let alive = true;
    uid = null; data = null; err = '';
    (async () => {
      const id = await resolveUser(want);
      if (!alive) return;
      if (!id) { err = 'Nobody by that name.'; return; }
      if (id === session.user?.uid) { go('you'); return; }
      const d = await loadUser(id);
      if (!alive) return;
      if (!d.profile.username && !d.posts.length) { err = 'This account has no page yet.'; return; }
      faces[id] = { username: d.profile.username, photoUrl: d.profile.photoUrl };
      followedAtLoad = social.following.has(id);
      uid = id;
      data = d;
    })().catch(e => { if (alive) err = human(e); });
    return () => { alive = false; };
  });

  const name = $derived(data ? data.profile.username || data.posts[0]?.authorName || 'someone' : '');
  const photo = $derived(data ? data.profile.photoUrl || data.posts[0]?.authorPhoto || null : null);
  // The count read at load, moved by any follow or unfollow made since.
  const followers = $derived(data && uid
    ? data.followers - (followedAtLoad ? 1 : 0) + (social.following.has(uid) ? 1 : 0) : 0);
  const likes = $derived(data ? data.posts.reduce((n, p) => n + (p.likeCount || 0), 0) : 0);
  const live = $derived(uid ? social.streams.find(s => s.uid === uid && onAir(s)) : undefined);
  const count = (t: Kind) => (data ? data.posts.filter(p => p.type === t).length : 0);
  const CHOICES = $derived(([
    { id: 'all', label: 'All', n: data?.posts.length || 0 },
    { id: 'video', label: 'Videos', n: count('video') },
    { id: 'short', label: 'Shorts', n: count('short') },
    { id: 'live', label: 'Streams', n: count('live') },
    { id: 'post', label: 'Posts', n: count('post') },
  ] as { id: 'all' | Kind; label: string; n: number }[]).filter(c => c.id === 'all' || c.n));
  const shown = $derived<Post[]>(data ? (filter === 'all' ? data.posts : data.posts.filter(p => p.type === filter)) : []);
</script>

<div class="page you">
  {#if err}
    <div class="empty"><b>{err}</b><span class="muted">Check the spelling, or find them through one of their posts.</span></div>
  {:else if !data || !uid}
    <div class="empty"><div class="spinner"></div></div>
  {:else}
    <div class="banner">
      {#if data.profile.bannerUrl}
        <img src={data.profile.bannerUrl} alt="" draggable="false" style:object-position="50% {data.profile.bannerY ?? 50}%" />
      {/if}
    </div>
    <div class="profile">
      <span class="ring"><Avatar name={name} photo={photo} size={104} /></span>
      <div class="who">
        <h1>{name}</h1>
        <div class="muted">@{data.profile.username || name} · {plural(followers, 'follower')} · {compact(data.following)} following · {plural(likes, 'like')}</div>
      </div>
      <div class="tools">
        {#if live}<a class="btn live" href="#/stream/{live.id}"><span class="dot"></span>Live now</a>{/if}
        <FollowButton uid={uid} />
      </div>
    </div>
    {#if data.profile.bio}<p class="bio selectable">{data.profile.bio}</p>{/if}
    <div class="chips">
      {#each CHOICES as c}
        <button class="chip" class:on={filter === c.id} onclick={() => (filter = c.id)}>{c.label} <i>{c.n}</i></button>
      {/each}
    </div>
    {#if shown.length}
      <div class="grid stagger">{#each shown as post, i (post.id)}<PostCard {post} index={i} />{/each}</div>
    {:else}
      <p class="muted none">Nothing here yet.</p>
    {/if}
  {/if}
</div>

<style>
  .you { padding: 20px 28px 48px; }
  .banner {
    position: relative; height: clamp(110px, 13vw, 220px); border-radius: 18px; overflow: hidden; border: 1px solid var(--line);
    background: radial-gradient(70% 140% at 18% 0%, rgba(34,197,94,.45), transparent 68%), radial-gradient(70% 150% at 82% 100%, rgba(59,130,246,.45), transparent 70%), var(--bg3);
  }
  .banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile { position: relative; display: flex; align-items: flex-end; gap: 18px; margin: -44px 0 10px; padding: 0 12px; flex-wrap: wrap; }
  .ring { padding: 4px; border-radius: 999px; background: var(--bg); display: grid; }
  .who { padding-bottom: 8px; min-width: 0; flex: 1; }
  h1 { margin: 0 0 4px; font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .tools { display: flex; gap: 8px; padding-bottom: 10px; }
  .live { background: #ef4444; color: #fff; border-color: transparent; }
  .dot { width: 8px; height: 8px; border-radius: 99px; background: #fff; animation: blink 1.4s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: .35; } }
  .bio { margin: 0 12px 16px; max-width: 760px; line-height: 1.6; color: var(--muted); white-space: pre-wrap; }
  .chips { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .chip i { font-style: normal; opacity: .6; margin-left: 5px; }
  .grid { display: grid; gap: 26px 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .none { padding: 40px 12px; }
  .empty { display: grid; gap: 8px; justify-items: center; text-align: center; padding: 80px 20px; }
  .empty b { font-size: 17px; }
</style>
