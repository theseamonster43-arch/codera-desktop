<script lang="ts">
  import PostCard from '../components/PostCard.svelte';
  import StreamCard from '../components/StreamCard.svelte';
  import Icon from '../components/Icon.svelte';
  import { session, face, type Kind, type Post } from '../lib/state.svelte';
  import { route } from '../lib/router.svelte';
  import { social, onAir, nudgeText, WEIGHT } from '../lib/social.svelte';
  import { rank, favourites, TOPIC_LABEL } from '../lib/taste.js';

  let filter = $state<'all' | Kind>('all');

  const query = $derived(route.name === 'search' ? route.arg.toLowerCase() : '');

  // What people search for says what they want to learn.
  $effect(() => { if (query) nudgeText(query, WEIGHT.search, 'search:' + query); });

  const shown = $derived.by(() => {
    // Saved streams are part of the feed; the whole feed is ranked for this person.
    let list: Post[] = rank(session.posts, social.taste, social.following);
    if (query) {
      list = list.filter(p => [p.title, p.body, p.code, p.description, p.lang, face(p).name]
        .some(v => v && String(v).toLowerCase().includes(query)));
    }
    return filter === 'all' ? list : list.filter(p => p.type === filter);
  });

  const shorts = $derived(query || filter !== 'all' ? [] : (rank(session.posts.filter(p => p.type === 'short'), social.taste, social.following) as Post[]).slice(0, 12));
  const liveNow = $derived(query ? social.streams.filter(s => onAir(s) && [s.title, s.authorName].some(v => v && v.toLowerCase().includes(query)))
    : filter === 'all' ? social.streams.filter(onAir).sort((a, b) => (+social.following.has(b.uid) - +social.following.has(a.uid)) || (b.watching || 0) - (a.watching || 0)) : []);
  const favs = $derived(favourites(social.taste).map((t: string) => (TOPIC_LABEL as Record<string, string>)[t] || t));
  const because = $derived(favs.length ? 'Because you watch ' + (favs.length > 1 ? favs.slice(0, -1).join(', ') + ' and ' + favs[favs.length - 1] : favs[0]) : '');
  const main = $derived(query || filter !== 'all' ? shown : shown.filter(p => p.type !== 'short'));

  const FILTERS: { id: 'all' | Kind; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'video', label: 'Videos' }, { id: 'short', label: 'Shorts' }, { id: 'post', label: 'Posts' },
  ];
</script>

<div class="page wrap">
  {#if query}
    <h1>{shown.length} result{shown.length === 1 ? '' : 's'} for “{route.arg}”</h1>
  {/if}

  <div class="chips">
    {#each FILTERS as f}
      <button class="chip" class:on={filter === f.id} onclick={() => (filter = f.id)}>{f.label}</button>
    {/each}
  </div>

  {#if !session.postsReady}
    <div class="grid">
      {#each Array(8) as _}<div><div class="skeleton ph"></div><div class="skeleton ln"></div><div class="skeleton ln s"></div></div>{/each}
    </div>
  {:else}
    {#if liveNow.length}
      <h2><Icon name="live" size={18} /> Live now</h2>
      <div class="grid stagger">{#each liveNow as s, i (s.id)}<StreamCard stream={s} index={i} />{/each}</div>
    {/if}

    {#if shorts.length}
      <h2>Shorts</h2>
      <div class="shelf stagger">
        {#each shorts as post, i (post.id)}<div class="shelf-item"><PostCard {post} index={i} /></div>{/each}
      </div>
    {/if}

    {#if main.length}
      {#if !query}<h2>{filter === 'all' ? 'Recommended' : FILTERS.find(f => f.id === filter)?.label}{#if because}<span class="because">{because}</span>{/if}</h2>{/if}
      <div class="grid stagger">
        {#each main as post, i (post.id)}<PostCard {post} index={i} />{/each}
      </div>
    {:else}
      <div class="empty">
        <b>{query ? 'Nothing matched' : 'Nothing here yet'}</b>
        <span class="muted">{query ? 'Try a shorter word, or the name of whoever posted it.' : 'Post something with Create — it lands on the phone and the website too.'}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap { padding: 20px 28px 48px; }
  h1 { margin: 4px 0 16px; font-size: 24px; font-weight: 900; letter-spacing: -0.7px; }
  h2 { margin: 26px 0 12px; font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .because, .more { font-size: 13px; font-weight: 600; color: var(--muted); margin-left: 4px; }
  .more:hover { color: var(--text); }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .grid { display: grid; gap: 26px 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); margin-top: 18px; }
  .shelf { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 6px; }
  .shelf-item { flex: 0 0 180px; }
  .ph { aspect-ratio: 16 / 9; }
  .ln { height: 12px; margin-top: 10px; border-radius: 6px; }
  .ln.s { width: 55%; }
  .empty { display: grid; gap: 6px; justify-items: center; text-align: center; padding: 80px 20px; }
  .empty b { font-size: 17px; }
</style>
