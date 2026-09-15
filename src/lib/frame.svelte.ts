import { inTauri } from './native';

/**
 * The window frame as the page needs to know it: whether this is a Mac, and
 * whether the window is fullscreen (the shell reports every change on a Mac).
 */
export const mac = inTauri && navigator.userAgent.includes('Mac');
export const frame = $state({ fullscreen: false });

if (mac) {
  import('@tauri-apps/api/event').then(({ listen }) =>
    listen<boolean>('codera://fullscreen', e => { frame.fullscreen = e.payload; }),
  );
}

/** Into or out of the Mac's real fullscreen. */
export async function toggleFullscreen() {
  if (!inTauri) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('codera_fullscreen');
}
