<script lang="ts">
  import { signOut } from 'firebase/auth';
  import Mark from '../components/Mark.svelte';
  import { auth } from '../lib/firebase';
  import { claimUsername, nameFree, NAME_OK, nameKey } from '../lib/actions';
  import { session } from '../lib/state.svelte';

  /** Everyone has a username; an account without one is asked, and cannot skip it. */
  let name = $state(nameKey((session.user?.displayName || session.user?.email?.split('@')[0] || '').slice(0, 20)));
  let status = $state<'' | 'checking' | 'free' | 'taken'>('');
  let err = $state('');
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  const key = $derived(nameKey(name));
  const shaped = $derived(NAME_OK.test(key));

  $effect(() => {
    const k = key;
    clearTimeout(timer);
    err = '';
    status = '';
    if (!k) return;
    if (!NAME_OK.test(k)) { err = k.length < 3 ? 'At least 3 characters.' : 'Letters, numbers and underscores only.'; return; }
    status = 'checking';
    timer = setTimeout(async () => {
      try { status = (await nameFree(k)) ? 'free' : 'taken'; } catch { status = ''; }
    }, 350);
  });

  async function claim(e: Event) {
    e.preventDefault();
    if (!shaped || busy || status === 'taken') return;
    busy = true;
    try {
      await claimUsername(key);
    } catch (e: any) {
      err = e?.code === 'permission-denied' ? `@${key} is taken. Try another.` : 'Something went wrong. Try again.';
      busy = false;
    }
  }
</script>

<div class="gate">
  <form class="box page" onsubmit={claim}>
    <Mark size={58} />
    <h1>Pick your username</h1>
    <p class="muted">How everyone sees you on Codera — on your posts, comments and page. Up to 20 characters. Nobody else can take it.</p>
    <div class="at"><span>@</span><input class="field" bind:value={name} maxlength="20" spellcheck="false" /></div>
    {#if err}<p class="err">{err}</p>
    {:else if status === 'checking'}<p class="muted">Checking…</p>
    {:else if status === 'free'}<p class="free">@{key} is free</p>
    {:else if status === 'taken'}<p class="err">@{key} is taken. Try another.</p>{/if}
    <button class="btn brand big" disabled={!shaped || busy || status === 'taken'}>{busy ? 'Claiming…' : 'Claim it'}</button>
    <p class="muted swap">Signed in as {session.user?.email} · <button type="button" onclick={() => signOut(auth)}>Sign out</button></p>
  </form>
</div>

<style>
  .gate { height: 100%; display: grid; place-items: center; padding: 24px; }
  .box { width: min(400px, 100%); display: grid; gap: 11px; }
  h1 { margin: 16px 0 0; font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  p { margin: 0; line-height: 1.55; }
  .free { color: var(--green); font-weight: 700; }
  .at { position: relative; }
  .at span { position: absolute; left: 14px; top: 0; height: 46px; display: grid; place-items: center; color: var(--muted); font-weight: 800; }
  .at .field { padding-left: 30px; }
  .swap { text-align: center; margin-top: 8px; }
  .swap button { border: 0; background: none; color: var(--blue); font-weight: 800; }
</style>
