import { inTauri } from './native';

/**
 * The window frame as the page needs to know it: whether this is a Mac, and
 * whether Codera's own fullscreen is on (the shell reports every change).
 */
export const mac = inTauri && navigator.userAgent.includes('Mac');
export const frame = $state({ fullscreen: false });

if (mac) {
  import('@tauri-apps/api/event').then(({ listen }) =>
    listen<boolean>('codera://fullscreen', e => { frame.fullscreen = e.payload; }),
  );
}

async function call(cmd: string, args?: Record<string, unknown>) {
  if (!inTauri) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke(cmd, args);
}

export const toggleFullscreen = () => call('codera_fullscreen');

/** While in fullscreen, the traffic lights show only with the pointer over the bar. */
export const showLights = (show: boolean) => call('codera_lights', { show });
