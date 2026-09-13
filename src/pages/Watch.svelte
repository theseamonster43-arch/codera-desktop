<script lang="ts">
  import Player from '../components/Player.svelte';
  import Avatar from '../components/Avatar.svelte';
  import Icon from '../components/Icon.svelte';
  import { session, face, myName, myPhoto, learnFaces } from '../lib/state.svelte';
  import {
    vote, watchMyVote, watchComments, addComment, deleteComment, deletePost, type Comment,
  } from '../lib/actions';
  import { ago, compact, plural, clock } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { ask, say } from '../lib/sheet.svelte';

  let { id }: { id: string } = $props();

  const post = $derived(session.posts.find(p => p.id === id));
  const who = $derived(post ? face(post) : { name: '', photo: null });
  const mine = $derived(!!post && post.uid === session.user?.uid);
  const next = $derived(session.posts.filter(p => p.id !== id && p.type !== 'short').slice(0, 16));

  let myVote = $state(0);
  let comments = $state<Comment[]>([]);
  let draft = $state('');
  let sending = $state(false);

  $effect(() => {
    const stopVote = watchMyVote(id, v => (myVote = v));
    const stopComments = watchComments(id, c => { comments = c; learnFaces(c); });
    return () => { stopVote(); stopComments(); };
  });

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    sending = true;
    draft = '';
    try { await addComment(id, text); } catch { draft = text; say("Couldn't post that comment."); }
    sending = false;
  }

  async function remove() {
    if (!post) return;
    const what = post.type === 'post' ? 'post' : post.type;
    if (!(await ask({ title: `Delete this ${what}?`, body: `“${post.title}” goes for good, with its likes and comments.`, yes: 'Delete', danger: true }))) return;
    await deletePost(post);
    say(`${what[0].toUpperCase() + what.slice(1)} deleted.`);
    go('you');
  }
</script>

{#if !post}
  <div class="gone">
    {#if session.postsReady}<b>That post is gone</b><span class="muted">It may have been deleted by whoever posted it.</span>
    {:else}<div class="spinner"></div>{/if}
  </div>
{:else}
  <div class="page watch">
    <div class="main">
      {#key id}
        {#if post.videoUrl}
          <Player src={post.videoUrl} postId={post.id} vertical={post.type === 'short'} />
        {:else if post.imageUrl}
          <img class="hero" src={post.imageUrl} alt="" draggable="false" />
        {/if}
      {/key}

      <h1 class="selectable">{post.title}</h1>

      <div class="byline">
        <Avatar name={who.name} photo={who.photo} size={40} />
        <div>
          <b>{who.name}</b>
          <div class="muted">{ago(post.createdAt)}{post.duration ? ' · ' + clock(post.duration) : ''}</div>
        </div>
        <div class="acts">
          <button class="btn" class:on={myVote === 1} onclick={() => vote(id, 1)}><Icon name="up" size={18} />{compact(post.likeCount)}</button>
          <button class="btn" class:down={myVote === -1} onclick={() => vote(id, -1)}><Icon name="down" size={18} />{compact(post.dislikeCount)}</button>
          {#if mine}<button class="btn danger" onclick={remove}><Icon name="trash" size={17} />Delete</button>{/if}
        </div>
      </div>

      {#if post.description || post.body || post.code}
        <div class="panel selectable">
          {#if post.lang}<div class="lang">{post.lang}</div>{/if}
          {#if post.description}<p>{post.description}</p>{/if}
          {#if post.body}<p>{post.body}</p>{/if}
          {#if post.code}<pre>{post.code}</pre>{/if}
        </div>
      {/if}

      <h2>{plural(post.commentCount, 'comment')}</h2>
      <form class="compose" onsubmit={e => { e.preventDefault(); send(); }}>
        <Avatar name={myName()} photo={myPhoto()} size={36} />
        <textarea class="field" bind:value={draft} rows="1" maxlength="1000" placeholder="Add a comment"
          onkeydown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}></textarea>
        <button class="btn brand" disabled={!draft.trim() || sending}>Comment</button>
      </form>

      {#each comments as c (c.id)}
        {@const cw = face(c)}
        <div class="comment">
          <Avatar name={cw.name} photo={cw.photo} size={34} />
          <div class="ctext">
            <div><b>{cw.name}</b> <span class="muted">{ago(c.createdAt)}</span></div>
            <p class="selectable">{c.text}</p>
          </div>
          {#if c.uid === session.user?.uid || mine}
            <button class="icon-btn x" onclick={() => deleteComment(id, c.id)} aria-label="Delete comment"><Icon name="trash" size={16} /></button>
          {/if}
        </div>
      {:else}
        <p class="muted">No comments yet. Say the first thing.</p>
      {/each}
    </div>

    <aside>
      <h2 class="up">Up next</h2>
      {#each next as n (n.id)}
        {@const nw = face(n)}
        <button class="row" onclick={() => go(`watch/${n.id}`)}>
          <div class="nthumb">
            {#if n.videoUrl}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video src={n.videoUrl} preload="metadata" muted></video>
              {#if n.duration}<span>{clock(n.duration)}</span>{/if}
            {:else}
              <div class="codeish"><Icon name="code" size={22} /></div>
            {/if}
          </div>
          <div class="nmeta">
            <b>{n.title}</b>
            <span class="muted">{nw.name}</span>
            <span class="muted">{plural(n.likeCount, 'like')} · {ago(n.createdAt)}</span>
          </div>
        </button>
      {/each}
    </aside>
  </div>
{/if}

<style>
  .gone { height: 100%; display: grid; place-content: center; justify-items: center; gap: 6px; }
  .watch { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 26px; padding: 20px 28px 48px; max-width: 1800px; margin: 0 auto; }
  @media (max-width: 1180px) { .watch { grid-template-columns: minmax(0, 1fr); } }
  .hero { width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius); background: var(--bg3); }
  h1 { margin: 16px 0 12px; font-size: 21px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.3; }
  h2 { margin: 26px 0 12px; font-size: 16px; font-weight: 800; }
  .byline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .acts { display: flex; gap: 8px; margin-left: auto; }
  .acts .on { color: var(--blue); border-color: color-mix(in srgb, var(--blue) 45%, var(--line)); }
  .acts .down { color: var(--red); border-color: color-mix(in srgb, var(--red) 45%, var(--line)); }
  .panel { margin-top: 16px; padding: 14px 16px; border-radius: var(--radius); background: var(--bg2); border: 1px solid var(--line); }
  .panel p { margin: 0 0 8px; white-space: pre-wrap; line-height: 1.6; }
  .panel pre { margin: 10px 0 0; padding: 12px; border-radius: 10px; background: var(--bg3); font: 12.8px/1.6 'Cascadia Code', Consolas, monospace; overflow-x: auto; }
  .lang { font-size: 11px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; color: var(--blue); margin-bottom: 6px; }

  .compose { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 18px; }
  .compose textarea { min-height: 40px; }
  .compose .btn { height: 40px; }
  .comment { display: flex; gap: 11px; padding: 12px 0; animation: rise .25s both; }
  .ctext { flex: 1; min-width: 0; }
  .ctext p { margin: 3px 0 0; white-space: pre-wrap; line-height: 1.55; }
  .x { opacity: 0; }
  .comment:hover .x { opacity: 1; }

  .up { margin-top: 0; }
  .row { all: unset; box-sizing: border-box; display: flex; gap: 10px; width: 100%; padding: 6px; border-radius: 12px; cursor: pointer; }
  .row:hover { background: var(--hover); }
  .nthumb { position: relative; flex: 0 0 156px; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: #000; }
  .nthumb video { width: 100%; height: 100%; object-fit: cover; }
  .nthumb span { position: absolute; right: 6px; bottom: 6px; padding: 1px 5px; border-radius: 5px; background: rgba(0,0,0,.8); color: #fff; font-size: 11px; font-weight: 700; }
  .codeish { width: 100%; height: 100%; display: grid; place-items: center; background: var(--bg3); color: var(--muted); }
  .nmeta { display: grid; gap: 2px; min-width: 0; align-content: start; }
  .nmeta b { font-size: 13.5px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .nmeta .muted { font-size: 12px; }
</style>
