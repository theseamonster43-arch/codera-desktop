<script lang="ts">
  import { sheet, answer, toast } from '../lib/sheet.svelte';

  function keys(e: KeyboardEvent) {
    if (!sheet.open) return;
    if (e.key === 'Escape') answer(false);
    if (e.key === 'Enter') answer(true);
  }
</script>

<svelte:window onkeydown={keys} />

{#if sheet.open}
  <div class="scrim" onclick={() => sheet.no !== null && answer(false)} role="presentation">
    <div class="card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="rule" class:danger={sheet.danger}></div>
      <h2>{sheet.title}</h2>
      {#if sheet.body}<p>{sheet.body}</p>{/if}
      <div class="row">
        {#if sheet.no !== null}<button class="btn big" onclick={() => answer(false)}>{sheet.no}</button>{/if}
        <button class="btn big yes" class:brand={!sheet.danger} class:red={sheet.danger} onclick={() => answer(true)}>{sheet.yes}</button>
      </div>
    </div>
  </div>
{/if}

{#if toast.shown}<div class="toast">{toast.text}</div>{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.6); display: grid; place-items: center; padding: 24px; animation: fade .16s both; }
  .card {
    width: min(440px, 100%); position: relative; overflow: hidden; padding: 26px 24px 20px; border-radius: 20px;
    background: var(--bg2); border: 1px solid var(--line); box-shadow: 0 30px 80px rgba(0,0,0,.45);
    animation: rise .24s cubic-bezier(.2, .9, .3, 1) both;
  }
  .rule { position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--brand); }
  .rule.danger { background: var(--red); }
  h2 { margin: 0; font-size: 21px; font-weight: 900; letter-spacing: -0.6px; }
  p { margin: 10px 0 0; color: var(--muted); font-size: 14.5px; line-height: 1.6; user-select: text; }
  .row { display: flex; gap: 10px; margin-top: 22px; }
  .row .btn { flex: 1; }
  .row .yes { flex: 1.35; }
  .red { background: var(--red); color: #fff; border: 0; }
  .toast {
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 110; padding: 11px 18px; border-radius: 99px;
    background: var(--text); color: var(--bg); font-weight: 700; box-shadow: 0 14px 40px rgba(0,0,0,.3); animation: rise .2s both;
  }
</style>
