import type { Timestamp } from 'firebase/firestore';

/** 1.2K, 3.4M — the counts under a video. */
export function compact(n: number | undefined | null): string {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/** "1 like", "12 likes". */
export const plural = (n: number | undefined, word: string) =>
  compact(n || 0) + ' ' + word + (n === 1 ? '' : 's');

/** 7:38, or 1:02:05 for anything past an hour. */
export function clock(sec: number | undefined | null): string {
  if (sec == null || !isFinite(sec)) return '0:00';
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** "just now", "5m", "3h", "2d", or a date. */
export function ago(ts: Timestamp | null | undefined): string {
  const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;
  if (!ms) return 'just now';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(ms).toLocaleDateString();
}

/** "Oct 13" — when Plus renews or runs out. */
export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Firebase and Stripe codes are not something to put in front of a person. */
export function human(e: any): string {
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/invalid-login-credentials': 'Wrong email or password.',
    'auth/user-not-found': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/invalid-email': "That doesn't look like an email address.",
    'auth/email-already-in-use': 'An account already uses that email. Sign in instead.',
    'auth/weak-password': 'Use at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed': 'No connection. Check your internet.',
    'permission-denied': "You don't have permission to do that.",
  };
  if (e?.code && map[e.code]) return map[e.code];
  // The Functions SDK tacks the HTTP status on the end: that is for us.
  // Other than a crash, what a Codera function says is written for people.
  if (typeof e?.code === 'string' && e.code.startsWith('functions/') && e.code !== 'functions/internal' && e.message) {
    return String(e.message).replace(/\s*\[\d+\]$/, '');
  }
  if (e instanceof Error && !(e as any).code && e.message) return e.message;
  return 'Something went wrong. Try again.';
}
