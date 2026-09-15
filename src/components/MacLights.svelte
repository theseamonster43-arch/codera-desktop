<script lang="ts">
  import { closeWindow } from '../lib/native';
  import { toggleFullscreen } from '../lib/frame.svelte';

  /**
   * The Mac's red, yellow and green buttons, for fullscreen. There AppKit keeps its
   * own buttons in the title strip it slides over the app, which Codera keeps
   * hidden, so the bar shows these instead, drawn to the system's size and colours.
   * As in fullscreen on any Mac, yellow is unavailable and green leaves fullscreen.
   */
</script>

<div class="lights">
  <button class="red" onclick={closeWindow} aria-label="Close">
    <svg viewBox="0 0 12 12"><path d="M3.8 3.8l4.4 4.4M8.2 3.8L3.8 8.2" /></svg>
  </button>
  <button class="yellow" disabled aria-label="Minimize"></button>
  <button class="green" onclick={toggleFullscreen} aria-label="Exit Full Screen">
    <svg viewBox="0 0 12 12"><path class="fill" d="M3 6.6h2.4V9zM9 5.4H6.6V3z" /></svg>
  </button>
</div>

<style>
  .lights { display: flex; gap: 8px; align-items: center; animation: fade .12s both; }
  button {
    width: 12px; height: 12px; padding: 0; border-radius: 50%; display: grid; place-items: center;
    border: 0.5px solid rgba(0, 0, 0, .18);
  }
  .red { background: #ff5f57; }
  .yellow { background: #febc2e; }
  .green { background: #28c840; }
  .yellow:disabled { background: #4b4f4c; border-color: rgba(255, 255, 255, .06); cursor: default; }
  svg { width: 12px; height: 12px; opacity: 0; }
  path { stroke: rgba(0, 0, 0, .6); stroke-width: 1.1; stroke-linecap: round; fill: none; }
  path.fill { stroke: none; fill: rgba(0, 0, 0, .6); }
  .lights:hover svg { opacity: 1; }
  button:active:not(:disabled) { filter: brightness(.85); }
</style>
