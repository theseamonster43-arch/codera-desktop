<script lang="ts">
  import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
  import Icon from '../components/Icon.svelte';
  import Mark from '../components/Mark.svelte';
  import Celebration from '../components/Celebration.svelte';
  import { session } from '../lib/state.svelte';
  import { plusIntent, plusCard, plusCardSave, plusCancel } from '../lib/actions';
  import { STRIPE_PK, SITE } from '../lib/firebase';
  import { shortDate, human } from '../lib/format';
  import { ask, say } from '../lib/sheet.svelte';

  const PERKS = [
    ['No ads on shorts or videos', 'Watch straight through, nothing between you and the tutorial.'],
    ['Every new Plus perk, first', 'Whatever gets built for Plus is yours the day it ships.'],
    ['Cancel anytime', 'Plus stays until the end of the month you paid for.'],
  ];

  type Mode = 'pay' | 'renew' | 'card';
  let mode = $state<Mode | null>(null);        // the form, while it is open
  let loading = $state(false);
  let paying = $state(false);
  let err = $state('');
  let startsAt = $state(0);
  let done = $state<{ title: string; body: string } | null>(null);

  let mount: HTMLDivElement | undefined = $state();
  let stripe: Stripe | null = null;
  let elements: StripeElements | null = null;
  let secret = '';
  let setupIntentId = '';
  let saving = false;

  const date = $derived(session.plus.endsAt ? shortDate(session.plus.endsAt) : '');

  const WORDS = $derived({
    pay: { title: 'Codera Plus', go: 'Subscribe · $10.00 today', lede: '$10.00 today, then every month until you cancel.' },
    renew: { title: 'Subscribe again', go: 'Subscribe again · $0 today', lede: `Nothing today. Your first $10.00 is on ${shortDate(startsAt || session.plus.endsAt)}.` },
    card: { title: 'Change card', go: 'Save card', lede: `Nothing is charged now. Your next $10.00${date ? ' on ' + date : ''} goes on this card.` },
  });

  async function open(want: 'pay' | 'card') {
    err = '';
    loading = true;
    try {
      let pk: string;
      if (want === 'card') {
        const d = await plusCard();
        secret = d.setupSecret; setupIntentId = d.setupIntentId; saving = true; mode = 'card';
        pk = d.livemode ? STRIPE_PK.live : STRIPE_PK.test;
      } else {
        const d = await plusIntent();
        // The server decides: a payment today, or — for someone still inside a
        // month they paid for — a card saved for when that month runs out.
        saving = !!d.setupSecret;
        secret = (d.setupSecret || d.clientSecret)!;
        startsAt = d.startsAt || 0;
        mode = saving ? 'renew' : 'pay';
        pk = d.livemode ? STRIPE_PK.live : STRIPE_PK.test;
      }

      stripe = await loadStripe(pk);
      if (!stripe) throw new Error('stripe');

      // Stripe's fields, dressed in Codera's own colours and typeface. The font comes
      // from the website, which lets Stripe's frame fetch it; the app's own copy is not reachable from there.
      const css = getComputedStyle(document.documentElement);
      const v = (n: string) => css.getPropertyValue(n).trim();
      elements = stripe.elements({
        clientSecret: secret,
        fonts: [
          { family: 'Scoutie Sans', src: `url(${SITE}/fonts/ScoutieSans-Medium.ttf)`, weight: '500' },
          { family: 'Scoutie Sans', src: `url(${SITE}/fonts/ScoutieSans-Bold.ttf)`, weight: '700' },
        ],
        appearance: {
          theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'stripe',
          variables: {
            fontFamily: "'Scoutie Sans', system-ui, sans-serif", fontSizeBase: '15px',
            colorPrimary: '#22c55e', colorBackground: v('--bg2'), colorText: v('--text'),
            colorTextSecondary: v('--muted'), colorDanger: '#ef4444', borderRadius: '12px',
          },
          rules: {
            '.Input': { border: '1px solid ' + v('--line'), boxShadow: 'none' },
            '.Input:focus': { border: '1px solid #3b82f6', boxShadow: 'none' },
            '.Label': { fontWeight: '700' },
          },
        },
      });
      // The form has to exist before Stripe's fields can be put in it.
      await new Promise(r => requestAnimationFrame(r));
      elements.create('payment', { layout: 'tabs' }).mount(mount!);
    } catch (e) {
      err = human(e);
      mode = null;
    }
    loading = false;
  }

  async function confirm() {
    if (!stripe || !elements || !mode) return;
    err = '';
    const checked = await elements.submit();
    if (checked.error) return (err = checked.error.message || 'Check the card details.');

    const q = {
      pay: ['Subscribe to Codera Plus?', 'You pay $10.00 today, then $10.00 every month until you cancel.', 'Pay $10.00'],
      renew: ['Subscribe to Codera Plus again?', `Nothing is charged today. $10.00 from ${shortDate(startsAt)}, then every month until you cancel.`, 'Confirm'],
      card: ['Use this card for Plus?', `Your next $10.00${date ? ' on ' + date : ''} goes on this card. Nothing is charged now.`, 'Use this card'],
    }[mode];
    if (!(await ask({ title: q[0], body: q[1], yes: q[2] }))) return;

    paying = true;
    const confirmParams = { return_url: location.href };
    const out = saving
      ? await stripe.confirmSetup({ elements, confirmParams, redirect: 'if_required' })
      : await stripe.confirmPayment({ elements, confirmParams, redirect: 'if_required' });
    paying = false;

    if (out.error) return (err = out.error.message || 'That did not go through.');
    if (mode === 'card') {
      try { await plusCardSave(setupIntentId); } catch (e) { return (err = human(e)); }
    }

    done = mode === 'pay'
      ? { title: 'Welcome to Codera Plus', body: 'Payment received. No more ads, and every new perk is yours first.' }
      : mode === 'renew'
        ? { title: 'Plus will carry on', body: `Card saved. Nothing charged today — your next $10.00 is on ${shortDate(startsAt)}.` }
        : { title: 'Card updated', body: 'From now on Plus is charged to this card.' };
    mode = null;
  }

  async function cancel() {
    if (!(await ask({ title: 'Cancel Codera Plus?', body: `You keep Plus until ${date}, and nothing more is charged after that.`, yes: 'Cancel Plus', no: 'Keep Plus', danger: true }))) return;
    try { await plusCancel(); say(`Plus is cancelled. It stays on until ${date}.`); }
    catch (e) { say(human(e)); }
  }
</script>

<div class="page plus">
  <div class="hero">
    <div class="orb"><Mark size={92} /></div>
    <h1>Codera <em>Plus</em></h1>
    <p class="muted">Support Codera, lose the ads, and get every perk the moment it exists.</p>
  </div>

  <div class="layout" class:paying={!!mode}>
    <div class="plan">
      <div class="plan-in">
        <div class="top">
          <span class="label">Monthly</span>
          {#if session.plus.active}
            <span class="pill" class:ending={session.plus.cancelled}>{session.plus.cancelled ? `Ends ${date}` : 'Active'}</span>
          {/if}
        </div>
        <div class="price"><b>$10</b><span>/ month</span></div>
        {#each PERKS as [t, b]}
          <div class="perk"><span class="tick"><Icon name="check" size={13} stroke={3} /></span><div><b>{t}</b><span class="muted">{b}</span></div></div>
        {/each}

        {#if !mode}
          {#if session.plus.loading}
            <div class="center"><div class="spinner"></div></div>
          {:else if session.plus.active && !session.plus.cancelled}
            <div class="two">
              <button class="btn big" onclick={() => open('card')} disabled={loading}><Icon name="card" size={18} />Change card</button>
              <button class="btn big danger" onclick={cancel}>Cancel Plus</button>
            </div>
            <p class="note muted">Renews {date}.</p>
          {:else}
            <button class="btn brand big full" onclick={() => open('pay')} disabled={loading}>
              {loading ? 'One moment…' : session.plus.cancelled ? 'Subscribe again' : 'Subscribe for $10/month'}
            </button>
            <p class="note muted">
              {session.plus.cancelled ? `Plus stays until ${date}. Subscribe again and nothing is charged until then.` : 'Renews monthly. Cancel anytime.'}
            </p>
          {/if}
        {/if}
      </div>
    </div>

    {#if mode}
      <div class="pay">
        <div class="payhead">
          <div><b>{WORDS[mode].title}</b><span class="muted">{WORDS[mode].lede}</span></div>
          <button class="btn" onclick={() => (mode = null)}>Back</button>
        </div>
        <div class="mount" bind:this={mount}></div>
        {#if err}<p class="err">{err}</p>{/if}
        <button class="btn brand big full" onclick={confirm} disabled={paying}>{paying ? 'Working…' : WORDS[mode].go}</button>
        <p class="note muted">Card details go straight to Stripe. Codera never sees them.</p>
      </div>
    {:else if err}
      <p class="err">{err}</p>
    {/if}
  </div>
</div>

{#if done}
  <Celebration title={done.title} body={done.body} onDone={() => (done = null)} />
{/if}

<style>
  .plus { padding: 28px 28px 56px; max-width: 1080px; margin: 0 auto; position: relative; }
  .plus::before {
    content: ''; position: absolute; inset: -80px -120px auto; height: 560px; z-index: -1; pointer-events: none;
    background: radial-gradient(40% 55% at 30% 30%, rgba(34,197,94,.28), transparent 70%), radial-gradient(40% 55% at 70% 40%, rgba(59,130,246,.28), transparent 72%);
  }
  .hero { text-align: center; }
  .orb { display: inline-grid; filter: drop-shadow(0 20px 50px rgba(34,197,94,.35)); animation: float 4.5s ease-in-out infinite; }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  h1 { margin: 18px 0 8px; font-size: 44px; font-weight: 900; letter-spacing: -1.6px; }
  h1 em { font-style: normal; background: var(--brand); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero p { margin: 0 auto 28px; max-width: 460px; line-height: 1.6; font-size: 15px; }

  .layout { display: grid; grid-template-columns: minmax(0, 440px); justify-content: center; gap: 22px; }
  .layout.paying { grid-template-columns: minmax(0, 380px) minmax(0, 1fr); }
  @media (max-width: 900px) { .layout.paying { grid-template-columns: 1fr; } }

  .plan { border-radius: 22px; padding: 1.5px; background: var(--brand); align-self: start; }
  .plan-in { border-radius: 20.5px; background: var(--bg2); padding: 24px; }
  .top { display: flex; align-items: center; }
  .top .label { margin: 0; }
  .pill { margin-left: auto; padding: 4px 11px; border-radius: 99px; background: var(--bg3); font-weight: 800; font-size: 12.5px; color: var(--green); }
  .pill.ending { color: var(--amber); }
  .price { display: flex; align-items: baseline; gap: 6px; margin: 12px 0 14px; }
  .price b { font-size: 46px; font-weight: 900; letter-spacing: -2px; }
  .price span { color: var(--muted); font-weight: 700; }
  .perk { display: flex; gap: 12px; padding: 8px 0; }
  .perk div { display: grid; gap: 2px; }
  .perk .muted { font-size: 13px; }
  .tick { width: 22px; height: 22px; border-radius: 99px; background: var(--brand); color: #fff; display: grid; place-items: center; flex: none; margin-top: 1px; }
  .full { width: 100%; margin-top: 18px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
  .note { text-align: center; font-size: 12.5px; margin: 12px 0 0; }
  .center { display: grid; place-items: center; padding: 24px; }

  .pay { border-radius: 22px; background: var(--bg2); border: 1px solid var(--line); padding: 22px; animation: rise .3s both; }
  .payhead { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
  .payhead div { flex: 1; display: grid; gap: 3px; }
  .payhead b { font-size: 18px; font-weight: 900; }
  .payhead .muted { font-size: 13.5px; }
  .mount { min-height: 200px; }
  .err { margin: 12px 0 0; }
</style>
