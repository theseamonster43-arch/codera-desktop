import { inTauri } from './native';

/**
 * The window frame as the page needs to know it: whether this is a Mac, whether
 * the window is fullscreen, and, in fullscreen, how far the menu bar has come down
 * into the window and whether the traffic lights belong on screen.
 */
export const mac = inTauri && navigator.userAgent.includes('Mac');
export const frame = $state({ fullscreen: false, push: 0, lights: false });

if (mac) {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<boolean>('codera://fullscreen', e => {
      frame.fullscreen = e.payload;
      if (!e.payload) { frame.push = 0; frame.lights = false; }
    });
    listen<{ push: number; lights: boolean }>('codera://reveal', e => {
      frame.push = e.payload.push;
      frame.lights = e.payload.lights;
    });
  });
}

/** Into or out of the Mac's real fullscreen. */
export async function toggleFullscreen() {
  if (!inTauri) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('codera_fullscreen');
}
