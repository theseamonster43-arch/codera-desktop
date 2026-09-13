<script lang="ts">
  import Mark from './Mark.svelte';
  import Icon from './Icon.svelte';

  /**
   * The moment someone becomes a Plus member, or keeps being one: the mark drops
   * in, rings ripple out, green and blue sparks fly, a check lands on the mark,
   * then the words rise in. Clicking the mark plays it again.
   */
  let { title, body, onDone }: { title: string; body: string; onDone: () => void } = $props();

  let take = $state(0);

  const sparks = $derived.by(() => {
    take; // a new spray on every replay
    return Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const d = 140 + Math.random() * 190;
      return {
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        size: 5 + Math.random() * 8,
        color: i % 2 ? '#60a5fa' : '#22c55e',
        spin: (Math.random() - 0.5) * 540,
        delay: Math.random() * 120,
      };
    });
  });
</script>

<svelte:window onkeydown={e => e.key === 'Escape' && onDone()} />

<div class="scene">
  {#key take}
    <div class="stage">
      {#each [0, 1, 2] as r}<span class="ring" style:animation-delay="{240 + r * 170}ms"></span>{/each}
      {#each sparks as p}
        <span class="spark" style:--x="{p.x}px" style:--y="{p.y}px" style:--r="{p.spin}deg"
          style:width="{p.size}px" style:height="{p.size}px" style:background={p.color}
          style:animation-delay="{260 + p.delay}ms"></span>
      {/each}
      <button class="mark" onclick={() => take++} title="Play again">
        <Mark size={116} />
        <span class="badge"><Icon name="check" size={20} stroke={3} /></span>
      </button>
    </div>
    <div class="words">
      <h1>{title}</h1>
      <p>{body}</p>
      <button class="btn brand big" onclick={onDone}>Start watching</button>
    </div>
  {/key}
</div>

<style>
  .scene {
    position: fixed; inset: 0; z-index: 90; display: grid; grid-template-rows: 1fr auto; padding-bottom: 60px;
    background: radial-gradient(50% 45% at 38% 40%, rgba(34,197,94,.3), transparent 70%), radial-gradient(50% 45% at 64% 48%, rgba(59,130,246,.28), transparent 70%), var(--bg);
    animation: fade .26s both;
  }
  .stage { position: relative; display: grid; place-items: center; }
  .mark { position: relative; border: 0; background: none; padding: 0; animation: drop .7s cubic-bezier(.3, 1.55, .5, 1) 80ms both; filter: drop-shadow(0 18px 40px rgba(34,197,94,.45)); }
  @keyframes drop { from { transform: scale(.25) rotate(-18deg); opacity: 0; } 35% { opacity: 1; } to { transform: none; opacity: 1; } }
  .badge {
    position: absolute; right: -12px; bottom: -12px; width: 42px; height: 42px; border-radius: 99px;
    background: var(--brand); color: #fff; display: grid; place-items: center; border: 3px solid var(--bg);
    animation: pop .5s cubic-bezier(.3, 1.8, .5, 1) 620ms both;
  }
  @keyframes pop { from { transform: scale(.2); opacity: 0; } to { transform: none; opacity: 1; } }

  .ring {
    position: absolute; width: 160px; height: 160px; border-radius: 99px; border: 3px solid transparent;
    background: linear-gradient(var(--bg), var(--bg)) padding-box, var(--brand) border-box;
    opacity: 0; animation: ripple 1.2s cubic-bezier(.22, 1, .36, 1) both;
    -webkit-mask: radial-gradient(circle, transparent 74px, #000 75px); mask: radial-gradient(circle, transparent 74px, #000 75px);
  }
  @keyframes ripple { 0% { transform: scale(.55); opacity: 0; } 15% { opacity: .85; } 100% { transform: scale(2.7); opacity: 0; } }

  .spark {
    position: absolute; border-radius: 99px; opacity: 0;
    animation: fly 1.1s cubic-bezier(.2, .8, .3, 1) both;
  }
  @keyframes fly {
    0% { transform: translate(0, 0) scale(.2) rotate(0); opacity: 0; }
    10% { opacity: 1; }
    70% { opacity: 1; }
    100% { transform: translate(var(--x), var(--y)) scale(.5) rotate(var(--r)); opacity: 0; }
  }

  .words { display: grid; justify-items: center; text-align: center; gap: 10px; padding: 0 24px; animation: rise .55s cubic-bezier(.22, 1, .36, 1) 760ms both; }
  h1 { margin: 0; font-size: 34px; font-weight: 900; letter-spacing: -1.2px; }
  p { margin: 0 0 14px; color: var(--muted); font-size: 15.5px; max-width: 460px; line-height: 1.6; }
  .words .btn { min-width: 260px; }
</style>
