<script lang="ts">
  import Icon from './Icon.svelte';
  import { openExternal } from '../lib/native';
  import { SITE } from '../lib/firebase';

  /**
   * The screen that stands in for the whole app when Codera can't be used
   * here: either because of where this is, or because this build is too old
   * to be trusted with the rules it doesn't know about.
   */
  let { kind, where = '' }: { kind: 'region' | 'outdated'; where?: string } = $props();
</script>

<div class="gate">
  <span class="mark"><Icon name={kind === 'region' ? 'noentry' : 'download'} size={30} /></span>

  {#if kind === 'region'}
    <h1>Codera isn't open in {where}</h1>
    <p>
      New online safety rules there set a minimum age of 16 for social platforms. Codera is a
      place for learning to code, which may well sit outside those rules — but we would rather
      be shut for a while than be open and wrong about a rule written to keep children safe.
    </p>
    <p>We're getting proper advice on it. If it says we're clear, this screen goes away and nothing of yours is lost.</p>
    <p class="small">Your computer says you're in {where}.</p>
  {:else}
    <h1>Time for a new Codera</h1>
    <p>
      This copy is too old to keep using. Codera has changed how it checks ages and where it's
      allowed to run, and a build that doesn't know those rules can't be allowed to ignore them.
    </p>
    <p>Everything of yours is exactly where you left it. Download the new one and sign back in.</p>
    <button class="btn brand" onclick={() => openExternal(`${SITE}/download.html`)}>Download Codera</button>
  {/if}
</div>

<style>
  .gate {
    height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; padding: 40px 24px; gap: 4px;
  }
  .mark {
    display: grid; place-items: center; width: 62px; height: 62px; border-radius: 50%;
    background: var(--hover); color: var(--muted); margin-bottom: 18px;
  }
  h1 { font-size: 25px; font-weight: 900; letter-spacing: -0.6px; margin: 0 0 14px; }
  p { color: var(--muted); line-height: 1.65; margin: 0 0 12px; max-width: 46ch; }
  .small { font-size: 13px; margin-top: 6px; }
  .btn { margin-top: 10px; }
</style>
