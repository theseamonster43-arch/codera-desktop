<script lang="ts">
  import Icon from './Icon.svelte';
  import { payoutsStatus, payoutsLink, payoutsDashboard, PAYOUT_COUNTRIES, type Payouts } from '../lib/social.svelte';
  import { openExternal } from '../lib/native';
  import { human } from '../lib/format';
  import { say } from '../lib/sheet.svelte';

  /**
   * "Tips from your streams": whether viewers can tip you, and the way into
   * Stripe to set up or manage where the money goes. Stripe keeps the bank
   * details and opens in the browser; Codera only learns whether it's ready.
   */
  let st = $state<Payouts | null>(null);
  let err = $state('');
  let busy = $state(false);
  let restarting = $state(false);

  const load = () => payoutsStatus().then(v => { st = v; err = ''; }).catch(e => (err = human(e)));
  load();
  // Back from Stripe in the browser: look again.
  $effect(() => {
    const again = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  });

  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }); } catch { /* codes then */ }
  const countries = PAYOUT_COUNTRIES
    .map(c => ({ code: c, name: names?.of(c) || c }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const waiting = $derived(st?.held ? `$${(st.held / 100).toFixed(2)}` : '');

  const mine = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  let country = $state(PAYOUT_COUNTRIES.includes(mine) ? mine : 'US');

  async function open(get: () => Promise<string>) {
    busy = true;
    try { await openExternal(await get()); }
    catch (e) { say(human(e)); }
    busy = false;
  }
  const setup = () => open(() => payoutsLink(country, restarting));
  const finish = () => open(() => payoutsLink());
  const dashboard = () => open(payoutsDashboard);
</script>

<div class="payouts">
  <div class="ico"><Icon name="tip" size={22} /></div>
  <div class="words">
    <b>Tips from your streams</b>
    <span class="muted">
      {#if err}{err}
      {:else if !st}Checking…
      {:else if st.ready}Viewers can tip you while you’re live. Codera keeps 3%; the rest is paid out to you by Stripe{st.payoutsEnabled ? '' : ' once your bank details are confirmed'}.{waiting ? ` ${waiting} in earlier tips is on its way to you.` : ''}
      {:else if st.hasAccount && !restarting}{waiting ? `You have ${waiting} in tips waiting. ` : ''}Almost there: Stripe needs a few more details before your tips can be paid to you.
        <button class="link" onclick={() => (restarting = true)}>Wrong country? Start again</button>
      {:else if restarting}Pick your country and Stripe will start a fresh setup.
      {:else if waiting}You have {waiting} in tips waiting. Set up payouts and it’s sent to your bank, along with every tip after it.
      {:else}Viewers can tip you while you’re live. Set up payouts to get the tips, minus Codera’s 3% and Stripe’s card fee, in your bank. Tips given before then are kept for you.
      {/if}
    </span>
  </div>
  {#if st}
    <div class="acts">
      {#if st.ready}
        <button class="btn" onclick={dashboard} disabled={busy}>Payouts dashboard</button>
      {:else if st.hasAccount && !restarting}
        <button class="btn brand" onclick={finish} disabled={busy}>{busy ? 'Opening Stripe…' : 'Finish setting up'}</button>
      {:else}
        <select class="field sel" bind:value={country} aria-label="Your country">
          {#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
        </select>
        <button class="btn brand" onclick={setup} disabled={busy}>{busy ? 'Opening Stripe…' : restarting ? 'Start again' : 'Set up payouts'}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .payouts {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 4px 0 20px; padding: 14px 16px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg2); max-width: 900px;
  }
  .ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex: none;
    background: color-mix(in srgb, #f59e0b 16%, transparent); color: #f59e0b; }
  .words { flex: 1; min-width: 220px; display: grid; gap: 3px; }
  .words .muted { font-size: 13.4px; line-height: 1.5; }
  .link { background: none; border: 0; padding: 0; font: inherit; color: var(--blue); font-weight: 600; cursor: pointer; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .sel { width: auto; min-width: 170px; appearance: none; cursor: pointer; padding-right: 34px;
    background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
    background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
</style>
