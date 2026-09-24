<script lang="ts">
  import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
  import Mark from '../components/Mark.svelte';
  import { auth } from '../lib/firebase';
  import { claimUsername, NAME_OK, nameKey } from '../lib/actions';
  import { human } from '../lib/format';
  import { inTauri, startDrag } from '../lib/native';
  import { signInThrough } from '../lib/handoff';
  import Icon from '../components/Icon.svelte';

  let mode = $state<'in' | 'up'>('in');
  let name = $state('');
  let email = $state('');
  let pass = $state('');
  let err = $state('');
  let busy = $state(false);

  /**
   * Google and GitHub. The provider's part happens in the real browser, on
   * learncodera.com, because Firebase will not sign anyone in from an origin
   * it cannot authorise — and Tauri's origin is one no dashboard can. What
   * comes back through codera:// is a token, never a password.
   */
  async function through(provider: 'google' | 'github') {
    err = '';
    busy = true;
    try {
      await signInThrough(provider);
    } catch (e) {
      err = human(e);
      busy = false;
    }
  }

  async function submit(e: Event) {
    e.preventDefault();
    err = '';
    const up = mode === 'up';
    if (up && !NAME_OK.test(nameKey(name))) return (err = 'Pick a username: 3–20 letters, numbers or underscores.');
    if (!email.trim()) return (err = 'Enter your email.');
    if (up && pass.length < 8) return (err = 'Use at least 8 characters.');
    if (!pass) return (err = 'Enter your password.');

    busy = true;
    try {
      if (up) {
        await createUserWithEmailAndPassword(auth, email.trim(), pass);
        // Taken in the moment between typing and claiming: the account is real,
        // so the username screen asks again rather than failing here.
        try { await claimUsername(name); } catch { /* asked again next */ }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      }
    } catch (e) {
      err = human(e);
      busy = false;
    }
  }
</script>

<div class="gate" onpointerdown={e => inTauri && e.target === e.currentTarget && startDrag()} role="presentation">
  <form class="box page" onsubmit={submit}>
    <Mark size={58} />
    <h1>{mode === 'up' ? 'Make an account' : 'Welcome back'}</h1>
    <p class="muted">{mode === 'up' ? 'One account for the app, the website and the desktop.' : 'Sign in with the account you use on your phone.'}</p>

    {#if mode === 'up'}
      <div class="at"><span>@</span><input class="field" bind:value={name} placeholder="username" maxlength="20" spellcheck="false" autocomplete="username" /></div>
    {/if}
    <input class="field" type="email" bind:value={email} placeholder="Email" autocomplete="email" />
    <input class="field" type="password" bind:value={pass} placeholder="Password" autocomplete={mode === 'up' ? 'new-password' : 'current-password'} />

    {#if err}<p class="err">{err}</p>{/if}

    <button class="btn brand big" disabled={busy}>
      {busy ? 'One moment…' : mode === 'up' ? 'Create account' : 'Sign in'}
    </button>

    <div class="or"><span>or</span></div>

    <button type="button" class="btn wide" disabled={busy} onclick={() => through('google')}>
      <Icon name="google" size={18} />Continue with Google
    </button>
    <button type="button" class="btn wide" disabled={busy} onclick={() => through('github')}>
      <Icon name="github" size={18} />Continue with GitHub
    </button>

    <p class="swap muted">
      {mode === 'up' ? 'Already have an account?' : 'New to Codera?'}
      <button type="button" onclick={() => { mode = mode === 'up' ? 'in' : 'up'; err = ''; }}>
        {mode === 'up' ? 'Sign in' : 'Make one'}
      </button>
    </p>
  </form>
</div>

<style>
  .or { display: flex; align-items: center; gap: 10px; width: 100%; margin: 4px 0 2px; }
  .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .or span { color: var(--muted); font-size: 12.5px; font-weight: 600; }
  .wide { width: 100%; justify-content: center; gap: 9px; height: 46px; }
  .gate {
    height: 100%; display: grid; place-items: center; padding: 24px;
    background:
      radial-gradient(60% 50% at 25% 20%, rgba(34, 197, 94, .18), transparent 70%),
      radial-gradient(60% 50% at 80% 80%, rgba(59, 130, 246, .18), transparent 70%),
      var(--bg);
  }
  .box { width: min(380px, 100%); display: grid; gap: 11px; }
  h1 { margin: 16px 0 0; font-size: 30px; font-weight: 900; letter-spacing: -1px; }
  p { margin: 0 0 12px; line-height: 1.55; }
  .err { margin: 0; }
  .btn { margin-top: 6px; }
  .at { position: relative; }
  .at span { position: absolute; left: 14px; top: 0; height: 46px; display: grid; place-items: center; color: var(--muted); font-weight: 800; }
  .at .field { padding-left: 30px; }
  .swap { text-align: center; margin-top: 10px; }
  .swap button { border: 0; background: none; color: var(--blue); font-weight: 800; }
</style>
