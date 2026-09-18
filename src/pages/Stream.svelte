<script lang="ts">
  import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
  import Avatar from '../components/Avatar.svelte';
  import Icon from '../components/Icon.svelte';
  import ChatPanel from '../components/ChatPanel.svelte';
  import FollowButton from '../components/FollowButton.svelte';
  import { face, session } from '../lib/state.svelte';
  import {
    studio, onAir, watchStreamDoc, voteStream, watchStreamVote, userHref, nudgePost, WEIGHT,
    tipIntent, tipConfirm, TIP_AMOUNTS, type Stream,
  } from '../lib/social.svelte';
  import { watchStream } from '../lib/live.js';
  import { STRIPE_PK, db } from '../lib/firebase';
  import { ago, compact, human } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { say } from '../lib/sheet.svelte';

  /** Watching someone's stream: the picture, the chat, likes and tips. */
  let { id }: { id: string } = $props();

  let s = $state<Stream | null>(null);
  let loaded = $state(false);
  let conn = $state('connecting');
  let muted = $state(true);
  let video: HTMLVideoElement | undefined = $state();
  let box: HTMLDivElement | undefined = $state();
  let viewer: { stop(): void } | null = null;

  // Votes show the moment they are pressed; the stream's document settles them.
  let mine = $state(0);
  let tally = $state({ like: 0, dislike: 0 });

  const who = $derived(s ? face(s) : { name: '', photo: null });
  const on = $derived(onAir(s));

  $effect(() => {
    if (studio.now?.id === id) { go('golive'); return; }
    const stop = watchStreamDoc(id, d => {
      s = d;
      loaded = true;
      if (d) tally = { like: d.likeCount || 0, dislike: d.dislikeCount || 0 };
    });
    const stopVote = watchStreamVote(id, v => (mine = v));
    return () => { stop(); stopVote(); viewer?.stop(); viewer = null; };
  });

  function connect() {
    viewer?.stop();
    if (!video || !session.user) return;
    conn = 'connecting';
    viewer = watchStream(db, id, session.user.uid, video, (st: string) => (conn = st));
  }

  // Connects once the stream is known to be on air and the video is on the page.
  let started = false;
  $effect(() => {
    if (on && video && !started) {
      started = true;
      nudgePost(s!, WEIGHT.stream, 'stream:' + id);
      connect();
    }
    if (!on && started) { viewer?.stop(); viewer = null; started = false; }
  });

  function vote(want: 1 | -1) {
    const had = mine;
    const now = had === want ? 0 : want;
    const before = { ...tally };
    tally = {
      like: tally.like + (now === 1 ? 1 : 0) - (had === 1 ? 1 : 0),
      dislike: tally.dislike + (now === -1 ? 1 : 0) - (had === -1 ? 1 : 0),
    };
    mine = now;
    voteStream(id, want)
      .then(v => { if (v) nudgePost(s!, v === 1 ? WEIGHT.like : WEIGHT.dislike); })
      .catch(e => { mine = had; tally = before; say(human(e)); });
  }

  function full() {
    if (document.fullscreenElement) document.exitFullscreen();
    else box?.requestFullscreen();
  }

  // ---- tips ----
  let tipping = $state(false);
  let amount = $state(500);
  let note = $state('');
  let tipErr = $state('');
  let tipBusy = $state(false);
  let payMount: HTMLDivElement | undefined = $state();
  let stripe: Stripe | null = null;
  let elements: StripeElements | null = $state(null);
  let intentId = '';

  function openTip() {
    tipping = true; amount = 500; note = ''; tipErr = ''; elements = null; intentId = '';
  }

  async function tipNext() {
    if (!s) return;
    tipErr = '';
    tipBusy = true;
    try {
      if (!elements) {
        const d = await tipIntent(id, amount, note);
        intentId = d.intentId;
        stripe = await loadStripe(d.livemode ? STRIPE_PK.live : STRIPE_PK.test);
        if (!stripe) throw new Error('Stripe didn’t load.');
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        elements = stripe.elements({
          clientSecret: d.clientSecret,
          appearance: { theme: dark ? 'night' : 'stripe', variables: { colorPrimary: '#22c55e', borderRadius: '12px' } },
        });
        await new Promise(r => requestAnimationFrame(r));
        elements.create('payment', { layout: 'tabs' }).mount(payMount!);
      } else {
        const out = await stripe!.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url: location.href } });
        if (out.error) throw new Error(out.error.message || 'That payment didn’t go through.');
        await tipConfirm(intentId);
        tipping = false;
        say('Tip sent. Thank you!');
      }
    } catch (e) {
      tipErr = human(e);
    }
    tipBusy = false;
  }
</script>

{#if !loaded}
  <div class="center"><div class="spinner"></div></div>
{:else if !s || !on}
  <div class="center gone">
    <Icon name="live" size={34} />
    <b>This stream has ended</b>
    <span class="muted">{s?.authorName ? `If ${s.authorName} saved it, it’s on the Live page.` : 'Streams that were saved are on the Live page.'}</span>
    <a class="btn" href="#/live">Go to Live</a>
  </div>
{:else}
  <div class="page layout">
    <div class="main">
      <div class="stage" bind:this={box}>
        <video bind:this={video} playsinline autoplay {muted}></video>
        <span class="tag">LIVE</span>
        {#if conn !== 'connected'}
          <div class="state">
            {#if conn === 'failed'}
              <span>Couldn’t connect to this stream.</span>
              <button class="btn" onclick={connect}>Try again</button>
            {:else}<div class="spinner"></div><span>Connecting…</span>{/if}
          </div>
        {/if}
        <div class="ctl">
          {#if muted}<button class="btn glass" onclick={() => { muted = false; video?.play().catch(() => {}); }}><Icon name="loud" size={17} />Turn sound on</button>{/if}
          <button class="icon-btn glass" onclick={full} aria-label="Full screen"><Icon name="full" size={18} /></button>
        </div>
      </div>

      <h1 class="selectable">{s.title}</h1>
      <div class="byline">
        <a href={userHref(s)}><Avatar name={who.name} photo={who.photo} size={40} /></a>
        <div class="who">
          <a href={userHref(s)}><b>{who.name}</b></a>
          <div class="muted">{compact(s.watching || 0)} watching · started {ago(s.startedAt)}</div>
        </div>
        <div class="acts">
          <FollowButton uid={s.uid} />
          <button class="btn" class:on={mine === 1} onclick={() => vote(1)}><Icon name="up" size={18} />{compact(Math.max(0, tally.like))}</button>
          <button class="btn" class:down={mine === -1} onclick={() => vote(-1)}><Icon name="down" size={18} />{compact(Math.max(0, tally.dislike))}</button>
          {#if s.uid !== session.user?.uid}<button class="btn tip" onclick={openTip}><Icon name="tip" size={18} />Tip</button>{/if}
        </div>
      </div>
    </div>
    <ChatPanel streamId={id} hostUid={s.uid} />
  </div>

  {#if tipping}
    <div class="scrim" role="presentation" onclick={e => e.target === e.currentTarget && !tipBusy && (tipping = false)}>
      <div class="sheet">
        <h2><Icon name="tip" size={22} /> Tip {who.name}</h2>
        <p class="muted">Your tip shows up highlighted in the chat for everyone watching.</p>
        <div class="amounts">
          {#each TIP_AMOUNTS as a}
            <button class="chip" class:on={amount === a} disabled={!!elements} onclick={() => (amount = a)}>${a / 100}</button>
          {/each}
        </div>
        <input class="field" bind:value={note} maxlength="200" placeholder="Add a message (optional)" disabled={!!elements} />
        <div class="pay" bind:this={payMount}></div>
        {#if tipErr}<p class="err">{tipErr}</p>{/if}
        <div class="row">
          <button class="btn" onclick={() => (tipping = false)} disabled={tipBusy}>Cancel</button>
          <button class="btn brand big" onclick={tipNext} disabled={tipBusy}>
            {tipBusy ? 'One moment…' : elements ? `Pay $${(amount / 100).toFixed(2)}` : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .center { height: 70%; display: grid; place-content: center; justify-items: center; gap: 10px; text-align: center; padding: 40px; }
  .gone b { font-size: 18px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 26px; padding: 20px 28px 48px; align-items: start; }
  @media (max-width: 1150px) { .layout { grid-template-columns: 1fr; } }
  .stage { position: relative; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; background: #000; }
  .stage:fullscreen { border-radius: 0; aspect-ratio: auto; }
  .stage video { width: 100%; height: 100%; object-fit: contain; display: block; }
  .tag { position: absolute; top: 12px; left: 12px; padding: 3px 8px; border-radius: 6px; background: #ef4444; color: #fff; font-size: 12px; font-weight: 900; letter-spacing: .5px; }
  .state { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 12px; color: #fff; font-weight: 700; background: rgba(0, 0, 0, .45); }
  .ctl { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 8px; }
  .glass { background: rgba(0, 0, 0, .6) !important; color: #fff !important; border-color: rgba(255, 255, 255, .2) !important; }
  h1 { font-size: 20px; font-weight: 800; margin: 16px 0 12px; }
  .byline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .who { flex: 1; min-width: 0; }
  .who a:hover b { text-decoration: underline; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .tip { color: #f59e0b; }
  .scrim { position: fixed; inset: 0; z-index: 80; background: rgba(0, 0, 0, .5); display: grid; place-items: center; padding: 20px; }
  .sheet { width: min(480px, 100%); background: var(--bg2); border: 1px solid var(--line); border-radius: 18px; padding: 22px; animation: rise .2s both; }
  .sheet h2 { margin: 0 0 6px; display: flex; align-items: center; gap: 8px; font-size: 20px; }
  .amounts { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
  .sheet .field { width: 100%; box-sizing: border-box; }
  .pay:not(:empty) { margin-top: 14px; }
  .err { color: #ef4444; font-weight: 600; font-size: 13.5px; }
  .row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
</style>
