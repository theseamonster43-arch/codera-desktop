/**
 * Codera's own dialogs, in place of the system's confirm() and alert().
 *
 *   if (await ask({ title, body, yes: 'Pay $10.00' })) { ... }
 *   await tell({ title: 'Card updated', body: '...' });
 *
 * <Sheet /> is mounted once, at the root, and draws whatever this holds.
 */
export const sheet = $state({
  open: false,
  title: '',
  body: '',
  yes: 'OK',
  no: 'Not now' as string | null,
  danger: false,
});

let answerWith: ((yes: boolean) => void) | null = null;

export function ask(o: { title: string; body?: string; yes?: string; no?: string | null; danger?: boolean }) {
  // A question still open is answered "no" before the next one is asked.
  answerWith?.(false);
  return new Promise<boolean>(resolve => {
    answerWith = resolve;
    sheet.title = o.title;
    sheet.body = o.body || '';
    sheet.yes = o.yes || 'OK';
    sheet.no = o.no === undefined ? 'Not now' : o.no;
    sheet.danger = !!o.danger;
    sheet.open = true;
  });
}

export const tell = (o: { title: string; body?: string; ok?: string }) =>
  ask({ title: o.title, body: o.body, yes: o.ok || 'Done', no: null }).then(() => undefined);

export function answer(yes: boolean) {
  sheet.open = false;
  const done = answerWith;
  answerWith = null;
  done?.(yes);
}

/** A short line at the bottom of the window that goes away on its own. */
export const toast = $state({ text: '', shown: false });
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function say(text: string) {
  toast.text = text;
  toast.shown = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.shown = false; }, 2600);
}
