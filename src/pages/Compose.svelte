<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { createPost, uploadVideo } from '../lib/actions';
  import { clock, human } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { say } from '../lib/sheet.svelte';

  let { kind = 'post' }: { kind?: string } = $props();
  const mode = $derived((['post', 'short', 'video'].includes(kind) ? kind : 'post') as 'post' | 'short' | 'video');

  let title = $state('');
  let body = $state('');
  let code = $state('');
  let lang = $state<string | null>(null);
  let description = $state('');
  let image = $state<File | null>(null);
  let video = $state<File | null>(null);
  let duration = $state(0);
  let progress = $state<number | null>(null);
  let err = $state('');
  let dropping = $state(false);

  const LANGS = ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'Java', 'C++', 'Other'];
  const SHORT_MAX = 60;

  const imageUrl = $derived(image ? URL.createObjectURL(image) : '');
  const videoUrl = $derived(video ? URL.createObjectURL(video) : '');

  function takeFile(file?: File | null) {
    if (!file) return;
    err = '';
    if (mode === 'post') {
      if (!file.type.startsWith('image/')) return (err = 'Posts take a picture. Use Short or Video for clips.');
      image = file;
      return;
    }
    if (!file.type.startsWith('video/')) return (err = 'That needs to be a video file.');
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      // A four-minute clip is not a short, however it arrived.
      if (mode === 'short' && probe.duration > SHORT_MAX + 0.5) {
        err = `That clip is ${clock(probe.duration)}. Shorts can be up to 1:00.`;
        return;
      }
      duration = probe.duration;
      video = file;
    };
    probe.src = URL.createObjectURL(file);
  }

  function browse() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = mode === 'post' ? 'image/*' : 'video/*';
    input.onchange = () => takeFile(input.files?.[0]);
    input.click();
  }

  async function publish() {
    err = '';
    if (!title.trim()) return (err = 'Give it a title.');
    progress = 0;
    try {
      if (mode === 'post') {
        if (!body.trim() && !code.trim()) { progress = null; return (err = 'Write something, or paste some code.'); }
        await createPost({ title, body, code, lang: code.trim() ? lang : null, image, onProgress: f => (progress = f) });
      } else {
        if (!video) { progress = null; return (err = 'Choose a video first.'); }
        await uploadVideo({ file: video, kind: mode, title, description, duration, onProgress: f => (progress = f) });
      }
      say(mode === 'post' ? 'Posted.' : `${mode === 'short' ? 'Short' : 'Video'} posted.`);
      go(mode === 'short' ? 'shorts' : '');
    } catch (e) {
      err = human(e);
      progress = null;
    }
  }
</script>

<div class="page compose">
  <div class="tabs">
    {#each [['post', 'Post', 'code'], ['short', 'Short', 'shorts'], ['video', 'Video', 'play']] as [id, label, icon]}
      <button class="tab" class:on={mode === id} onclick={() => go(`new/${id}`)}><Icon name={icon} size={18} />{label}</button>
    {/each}
  </div>

  <div class="grid">
    <div class="form">
      <input class="field title" bind:value={title} placeholder="Title" maxlength="120" />

      {#if mode === 'post'}
        <textarea class="field" bind:value={body} rows="5" maxlength="4000" placeholder="What did you learn, build or break?"></textarea>
        <div class="label">Code</div>
        <textarea class="field mono" bind:value={code} rows="8" maxlength="8000" spellcheck="false" placeholder="// optional snippet"></textarea>
        {#if code.trim()}
          <div class="langs">{#each LANGS as l}<button class="chip" class:on={lang === l} onclick={() => (lang = lang === l ? null : l)}>{l}</button>{/each}</div>
        {/if}
      {:else}
        <textarea class="field" bind:value={description} rows="5" maxlength="4000" placeholder="Description (optional)"></textarea>
      {/if}

      {#if err}<p class="err">{err}</p>{/if}
      {#if progress !== null}
        <div class="bar"><i style:width="{progress * 100}%"></i></div>
      {/if}

      <div class="row">
        <button class="btn" onclick={() => go('')}>Cancel</button>
        <button class="btn brand big" onclick={publish} disabled={progress !== null}>
          {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : mode === 'post' ? 'Post' : 'Publish'}
        </button>
      </div>
    </div>

    <!-- Drag a file from Explorer onto the drop zone, the desktop way to attach it. -->
    <div
      class="drop" class:dropping
      ondragover={e => { e.preventDefault(); dropping = true; }}
      ondragleave={() => (dropping = false)}
      ondrop={e => { e.preventDefault(); dropping = false; takeFile(e.dataTransfer?.files?.[0]); }}
      role="region" aria-label="Drop a file"
    >
      {#if mode === 'post' && image}
        <img src={imageUrl} alt="" /><button class="btn small" onclick={() => (image = null)}>Remove picture</button>
      {:else if mode !== 'post' && video}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={videoUrl} controls></video>
        <span class="muted">{video.name} · {clock(duration)}</span>
      {:else}
        <Icon name={mode === 'post' ? 'image' : 'play'} size={34} />
        <b>{mode === 'post' ? 'Drop a picture' : mode === 'short' ? 'Drop a short' : 'Drop a video'}</b>
        <span class="muted">{mode === 'short' ? 'Up to 60 seconds. Vertical works best.' : mode === 'video' ? 'Screen recordings work well.' : 'Optional.'}</span>
        <button class="btn" onclick={browse}>Choose a file</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .compose { padding: 22px 28px 48px; max-width: 1180px; margin: 0 auto; }
  .tabs { display: flex; gap: 6px; margin-bottom: 20px; }
  .tab { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg2); font-weight: 700; }
  .tab.on { background: var(--text); color: var(--bg); border-color: transparent; }
  .grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 22px; align-items: start; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .form { display: grid; gap: 12px; }
  .title { height: 52px; font-size: 18px; font-weight: 800; }
  .mono { font: 13px/1.6 'Cascadia Code', Consolas, monospace; }
  .langs { display: flex; flex-wrap: wrap; gap: 6px; }
  .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .bar { height: 6px; border-radius: 99px; background: var(--bg3); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--brand); transition: width .2s; }
  .drop {
    min-height: 320px; border-radius: 18px; border: 1.5px dashed var(--line); background: var(--bg2);
    display: grid; place-content: center; justify-items: center; gap: 8px; padding: 18px; text-align: center; color: var(--muted);
    transition: border-color .15s, background .15s;
  }
  .drop.dropping { border-color: var(--blue); background: color-mix(in srgb, var(--blue) 8%, var(--bg2)); }
  .drop b { color: var(--text); font-size: 16px; }
  .drop img, .drop video { max-width: 100%; max-height: 360px; border-radius: 12px; background: #000; }
  .small { height: 32px; font-size: 13px; }
</style>
