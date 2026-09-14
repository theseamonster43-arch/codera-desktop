<script lang="ts">
  import { onMount } from 'svelte';
  import { inTauri, minimize, toggleMaximize, closeWindow } from '../lib/native';

  /**
   * Minimise, maximise and close for Windows, drawn with Windows' own icon font
   * (Segoe Fluent Icons on 11, Segoe MDL2 Assets on 10) so they are the same
   * glyphs every system window uses. Fixed to the window's top-right corner and
   * mounted on every screen, so they are there whatever the app is showing.
   * A Mac keeps its real traffic lights instead, so nothing is drawn there.
   */
  let { compact = false }: { compact?: boolean } = $props();

  const show = inTauri && !navigator.userAgent.includes('Mac');
  let maxed = $state(false);

  onMount(() => {
    if (!show) return;
    let off: (() => void) | undefined;
    let gone = false;
    (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      maxed = await win.isMaximized();
      const stop = await win.onResized(async () => { maxed = await win.isMaximized(); });
      if (gone) stop(); else off = stop;
    })();
    return () => { gone = true; off?.(); };
  });
</script>

{#if show}
  <div class="controls" class:compact>
    <button onclick={minimize} aria-label="Minimize" title="Minimize">&#xE921;</button>
    <button onclick={toggleMaximize} aria-label={maxed ? 'Restore' : 'Maximize'} title={maxed ? 'Restore Down' : 'Maximize'}>
      {maxed ? '' : ''}
    </button>
    <button class="close" onclick={closeWindow} aria-label="Close" title="Close">&#xE8BB;</button>
  </div>
{/if}

<style>
  .controls { position: fixed; top: 0; right: 0; z-index: 1000; display: flex; height: var(--titlebar); }
  .controls.compact { height: 32px; }
  button {
    width: 46px; height: 100%; border: 0; border-radius: 0; padding: 0; background: transparent; color: var(--text);
    font: 10px 'Segoe Fluent Icons', 'Segoe MDL2 Assets'; display: grid; place-items: center;
    transition: background-color .1s;
  }
  button:hover { background: color-mix(in srgb, var(--text) 9%, transparent); }
  button:active { background: color-mix(in srgb, var(--text) 5%, transparent); }
  .close:hover { background: #c42b1c; color: #fff; }
  .close:active { background: #c83c31; color: #fff; }
  .compact button { color: #fff; }
</style>
