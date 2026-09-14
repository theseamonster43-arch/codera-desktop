/**
 * Everything that only the desktop shell can do, behind one door.
 *
 * The same UI also runs in a plain browser tab — which is how it is developed
 * and tested — so every call checks it is really inside Tauri first and falls
 * back to the nearest browser equivalent, or to nothing, when it is not.
 */

export const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function currentWindow() {
  if (!inTauri) return null;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export async function minimize() { (await currentWindow())?.minimize(); }
export async function toggleMaximize() { (await currentWindow())?.toggleMaximize(); }
export async function closeWindow() { (await currentWindow())?.close(); }
export async function startDrag() { (await currentWindow())?.startDragging(); }

/** Opens a link in the real browser rather than inside Codera. */
export async function openExternal(url: string) {
  if (!inTauri) { window.open(url, '_blank', 'noopener'); return; }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}

/** A system notification — the kind that appears even with Codera behind other windows. */
export async function notify(title: string, body: string) {
  if (!inTauri) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
    return;
  }
  const n = await import('@tauri-apps/plugin-notification');
  let ok = await n.isPermissionGranted();
  if (!ok) ok = (await n.requestPermission()) === 'granted';
  if (ok) n.sendNotification({ title, body });
}

/**
 * The mini player: the video, alone, in a small window that stays above
 * everything else — so a tutorial can keep playing beside the editor it is
 * teaching. It picks up at the second it was popped out at.
 */
export async function popOut(postId: string, at: number) {
  const hash = `#/mini/${encodeURIComponent(postId)}?t=${Math.floor(at)}`;
  if (!inTauri) {
    window.open(location.origin + location.pathname + hash, 'codera-mini', 'width=480,height=300');
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel('mini');
  if (existing) await existing.close();
  new WebviewWindow('mini', {
    url: 'index.html' + hash,
    title: 'Codera — mini player',
    width: 480,
    height: 290,
    minWidth: 320,
    minHeight: 200,
    alwaysOnTop: true,
    // The system title bar, so minimise, maximise and close are always there.
    decorations: true,
    resizable: true,
    // Same scheme as the main window, so both share one origin and one sign-in.
    useHttpsScheme: true,
  });
}
