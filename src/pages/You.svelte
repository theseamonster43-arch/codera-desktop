<script lang="ts">
  import Avatar from '../components/Avatar.svelte';
  import Icon from '../components/Icon.svelte';
  import PostCard from '../components/PostCard.svelte';
  import { session, myName, myPhoto, type Kind } from '../lib/state.svelte';
  import { setProfileImage, setBio } from '../lib/actions';
  import { plural } from '../lib/format';
  import { say } from '../lib/sheet.svelte';
  import { go } from '../lib/router.svelte';

  const mine = $derived(session.posts.filter(p => p.uid === session.user?.uid));
  const likes = $derived(mine.reduce((n, p) => n + (p.likeCount || 0), 0));

  let filter = $state<'all' | Kind>('all');
  const shown = $derived(filter === 'all' ? mine : mine.filter(p => p.type === filter));
  const count = (k: Kind) => mine.filter(p => p.type === k).length;

  let editingBio = $state(false);
  let bio = $state('');
  let busy = $state<'' | 'banner' | 'photo'>('');

  async function pick(kind: 'banner' | 'photo', file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return say('That needs to be a picture.');
    busy = kind;
    try { await setProfileImage(kind, file); say(kind === 'banner' ? 'Banner updated.' : 'Picture updated.'); }
    catch { say("Couldn't save that picture."); }
    busy = '';
  }

  function choose(kind: 'banner' | 'photo') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => pick(kind, input.files?.[0]);
    input.click();
  }

  let dropping = $state(false);
</script>

<div class="page you">
  <!-- Drop a picture straight onto the banner, the fastest way to set one. -->
  <div
    class="banner" class:dropping
    ondragover={e => { e.preventDefault(); dropping = true; }}
    ondragleave={() => (dropping = false)}
    ondrop={e => { e.preventDefault(); dropping = false; pick('banner', e.dataTransfer?.files?.[0]); }}
    role="region" aria-label="Banner"
  >
    {#if session.profile.bannerUrl}
      <img src={session.profile.bannerUrl} alt="" draggable="false" style:object-position="50% {session.profile.bannerY ?? 50}%" />
    {:else}
      <div class="hint"><b>Add a banner</b><span>Drop a picture here, or press the button.</span></div>
    {/if}
    <button class="btn edit" onclick={() => choose('banner')} disabled={busy === 'banner'}>
      <Icon name="image" size={17} />{busy === 'banner' ? 'Uploading…' : session.profile.bannerUrl ? 'Change banner' : 'Add a banner'}
    </button>
  </div>

  <div class="profile">
    <button class="face" onclick={() => choose('photo')} title="Change picture">
      <Avatar name={myName()} photo={myPhoto()} size={104} />
      <span class="cam">{busy === 'photo' ? '…' : '✎'}</span>
    </button>
    <div class="who">
      <h1>{myName()} {#if session.plus.active}<span class="plus-tag">PLUS</span>{/if}</h1>
      <div class="muted">@{myName()} · {plural(mine.length, 'post')} · {plural(likes, 'like')}</div>
    </div>
    <div class="tools">
      <button class="btn" onclick={() => go('plus')}><Icon name="sparkle" size={17} />Codera Plus</button>
      <button class="btn brand" onclick={() => go('new/post')}><Icon name="plus" size={17} />Create</button>
    </div>
  </div>

  <div class="bio">
    {#if editingBio}
      <textarea class="field" bind:value={bio} maxlength="300" rows="3" placeholder="Say what you post about."></textarea>
      <div class="biorow">
        <span class="muted">{300 - bio.length} left</span>
        <button class="btn" onclick={() => (editingBio = false)}>Cancel</button>
        <button class="btn brand" onclick={async () => { await setBio(bio); editingBio = false; say('Description saved.'); }}>Save</button>
      </div>
    {:else}
      {#if session.profile.bio}<p class="selectable">{session.profile.bio}</p>{/if}
      <button class="btn ghost small" onclick={() => { bio = session.profile.bio || ''; editingBio = true; }}>
        {session.profile.bio ? 'Edit description' : 'Add a description'}
      </button>
    {/if}
  </div>

  <div class="chips">
    <button class="chip" class:on={filter === 'all'} onclick={() => (filter = 'all')}>All <i>{mine.length}</i></button>
    <button class="chip" class:on={filter === 'post'} onclick={() => (filter = 'post')}>Posts <i>{count('post')}</i></button>
    <button class="chip" class:on={filter === 'short'} onclick={() => (filter = 'short')}>Shorts <i>{count('short')}</i></button>
    <button class="chip" class:on={filter === 'video'} onclick={() => (filter = 'video')}>Videos <i>{count('video')}</i></button>
  </div>

  {#if shown.length}
    <div class="grid stagger">{#each shown as post, i (post.id)}<PostCard {post} index={i} />{/each}</div>
  {:else}
    <p class="muted none">Nothing here yet. Use Create to post something.</p>
  {/if}
</div>

<style>
  .you { padding: 20px 28px 48px; }
  .banner {
    position: relative; height: clamp(150px, 16vw, 260px); border-radius: 18px; overflow: hidden; border: 1px solid var(--line);
    background: radial-gradient(70% 140% at 18% 0%, rgba(34,197,94,.45), transparent 68%), radial-gradient(70% 150% at 82% 100%, rgba(59,130,246,.45), transparent 70%), var(--bg3);
    transition: box-shadow .15s;
  }
  .banner.dropping { box-shadow: inset 0 0 0 3px var(--blue); }
  .banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hint { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 4px; color: #fff; }
  .edit { position: absolute; right: 14px; bottom: 14px; background: rgba(0,0,0,.45); color: #fff; border-color: rgba(255,255,255,.2); backdrop-filter: blur(10px); }

  .profile { position: relative; display: flex; align-items: flex-end; gap: 18px; margin: -44px 0 8px; padding: 0 12px; }
  .face { position: relative; border: 0; padding: 4px; border-radius: 999px; background: var(--bg); }
  .cam { position: absolute; right: 6px; bottom: 6px; width: 28px; height: 28px; border-radius: 99px; background: var(--bg2); border: 1px solid var(--line); display: grid; place-items: center; font-size: 13px; }
  .who { padding-bottom: 8px; min-width: 0; }
  h1 { margin: 0 0 4px; font-size: 28px; font-weight: 900; letter-spacing: -1px; display: flex; align-items: center; gap: 10px; }
  .tools { margin-left: auto; display: flex; gap: 8px; padding-bottom: 10px; }

  .bio { padding: 0 12px; margin-bottom: 18px; max-width: 760px; }
  .bio p { margin: 4px 0 6px; color: var(--muted); line-height: 1.6; white-space: pre-wrap; }
  .biorow { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .biorow span { flex: 1; font-size: 12.5px; }
  .small { height: 30px; padding: 0 10px; font-size: 13px; color: var(--muted); }

  .chips { display: flex; gap: 8px; margin-bottom: 18px; }
  .chip i { font-style: normal; opacity: .6; margin-left: 5px; }
  .grid { display: grid; gap: 26px 18px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .none { padding: 40px 12px; }
</style>
