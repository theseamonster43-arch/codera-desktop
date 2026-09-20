<script lang="ts">
  import Icon from './Icon.svelte';
  import { openExternal } from '../lib/native';
  import {
    ADULT_AGE, CHECKS_OPEN, MAX_LINKS, asUrl, chipsFor, isAdult, linkProblem,
    setLinks, startAgeCheck,
  } from '../lib/safety.svelte';
  import { say } from '../lib/sheet.svelte';

  /**
   * Where else a creator can be found.
   *
   * It opens for adults on both sides: you prove your age to put links up, and
   * you prove it to open someone else's. Proof is a check somebody else did —
   * never a date typed into a box — because a link leads off Codera, where
   * these rules stop and nobody is watching who is at the other end.
   */
  let { links, mine = false }: { links: unknown; mine?: boolean } = $props();

  const chips = $derived(chipsFor(links));
  const shown = $derived(mine || isAdult());

  let editing = $state(false);
  let rows = $state<string[]>([]);
  let bad = $state(-1);
  let err = $state('');
  let busy = $state(false);

  function edit() {
    const have = Array.isArray(links) ? (links as string[]).slice(0, MAX_LINKS) : [];
    rows = have.length ? have : [''];
    bad = -1;
    err = '';
    editing = true;
  }

  // Off Codera, so it opens in the real browser rather than inside the app —
  // a window with no address bar is exactly where you don't want a stranger's
  // link to land.
  const away = (href: string) => { openExternal(href).catch(() => {}); };

  async function check() {
    try { away(await startAgeCheck()); say('Finish the check in your browser. This page updates by itself.'); }
    catch { say('Couldn’t start the check. Try again shortly.'); }
  }

  async function save() {
    const kept: string[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const text = rows[i].trim();
      if (!text) continue;
      const problem = linkProblem(text);
      if (problem) { bad = i; err = problem; return; }
      kept.push(asUrl(text)!.href);
    }
    bad = -1;
    err = '';
    busy = true;
    try { await setLinks(kept); editing = false; say('Links saved.'); }
    catch { err = 'Couldn’t save that. Check your connection.'; }
    busy = false;
  }
</script>

{#if editing}
  <div class="editor">
    <p class="why">
      Your channel, your GitHub, your site — up to {MAX_LINKS}. They show on your profile
      to anyone {ADULT_AGE} or over. A link that opens a private message with you isn't allowed.
    </p>
    {#each rows as row, i}
      <div class="row">
        <input
          class="field" class:bad={bad === i} type="url" maxlength="200"
          placeholder="https://youtube.com/@you" bind:value={rows[i]}
          autocomplete="off" spellcheck="false"
        />
        <button class="btn ghost small" aria-label="Remove"
                onclick={() => { rows = rows.filter((_, n) => n !== i); if (!rows.length) rows = ['']; }}>
          <Icon name="close" size={16} />
        </button>
      </div>
    {/each}
    {#if err}<p class="err">{err}</p>{/if}
    <div class="acts">
      {#if rows.length < MAX_LINKS}
        <button class="btn ghost small" onclick={() => { rows = [...rows, '']; }}>Add another</button>
      {/if}
      <span class="spacer"></span>
      <button class="btn ghost small" onclick={() => { editing = false; }}>Cancel</button>
      <button class="btn brand small" disabled={busy} onclick={save}>{busy ? 'Saving…' : 'Save'}</button>
    </div>
  </div>
{:else}
  {#if chips.length && shown}
    <div class="socials">
      {#each chips as c (c.href)}
        <button class="social" title={c.href} onclick={() => away(c.href)}>
          <Icon name={c.key} size={16} />
          <span>{c.text}</span>
        </button>
      {/each}
    </div>
  {:else if chips.length}
    <div class="shut">
      <Icon name="lock" size={16} />
      <span>
        {chips.length}{chips.length > 1 ? ' links' : ' link'} to where they are off Codera —
        {chips.length > 1 ? 'these open' : 'it opens'} once you've confirmed you're {ADULT_AGE} or over.
      </span>
      {#if CHECKS_OPEN}<button class="btn ghost small" onclick={check}>Confirm your age</button>{/if}
    </div>
  {/if}

  {#if mine}
    {#if isAdult()}
      <button class="btn ghost small edit" onclick={edit}>
        {chips.length ? 'Edit links' : 'Add your links'}
      </button>
    {:else}
      <div class="shut">
        <Icon name="lock" size={16} />
        <span>Your channel, your GitHub, your site — confirm you're {ADULT_AGE} or over to put them here.</span>
        {#if CHECKS_OPEN}<button class="btn ghost small" onclick={check}>Confirm your age</button>{/if}
      </div>
    {/if}
  {/if}
{/if}

<style>
  .socials { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 12px 12px; }
  .social {
    display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px;
    border-radius: 999px; border: 1px solid var(--line); background: var(--hover);
    color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer;
    max-width: 220px; transition: border-color 0.12s ease, color 0.12s ease;
  }
  .social span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .social:hover { border-color: var(--brand); color: var(--brand); }
  .shut {
    display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
    margin: 0 12px 12px; color: var(--muted); font-size: 13px; line-height: 1.5;
  }
  .edit { margin: 0 12px 16px; }
  .editor { margin: 0 12px 16px; max-width: 560px; }
  .why { color: var(--muted); font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; }
  .row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .row .field { flex: 1; }
  .row .field.bad { border-color: var(--red); }
  .err { color: var(--red); font-size: 12.5px; margin: 0 0 8px; line-height: 1.5; }
  .acts { display: flex; align-items: center; gap: 8px; }
  .spacer { flex: 1; }
</style>
