import {
  addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, increment, limit,
  onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { auth, db, functions, storage } from './firebase';
import { faces, learnFaces, session, type Post } from './state.svelte';
import { learn, topicsOf, topicsOfText, WEIGHT } from './taste.js';
import { inTauri } from './native';
import { hostStream, recorder, mixer, capture } from './live.js';

/**
 * Following, live streams and recommendations: the same collections and rules
 * as the website (web/app.js) and the phone app, so a follow, a stream or a
 * vote made here is the same one everywhere.
 */

export interface Stream {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string | null;
  title: string;
  live: boolean;
  watching?: number;
  likeCount?: number;
  dislikeCount?: number;
  tips?: number;
  startedAt?: any;
  beat?: any;
}

export interface ChatMessage {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  tip?: number;
  at?: any;
}

export const social = $state({
  following: new Set<string>(),
  streams: [] as Stream[],
  taste: {} as Record<string, number>,
});

const millis = (ts: any) => (ts && ts.toMillis ? ts.toMillis() : 0);

/**
 * Whether a stream is really on air: marked live, and its streamer's app has
 * checked in within the last minute or so. A crashed streamer never says the
 * stream is over; this is how it stops being listed.
 */
export function onAir(s: Stream | null | undefined) {
  if (!s || !s.live) return false;
  const beat = millis(s.beat);
  return !beat || Date.now() - beat < 75000;
}

let stops: (() => void)[] = [];

// Until the saved scores have been read, actions wait here: writing before then
// would replace everything learned so far with just the latest action.
let tasteReady = false;
let tastePending: [string[], number][] = [];

/** Starts the listeners for a signed-in account; call with null on sign-out. */
export function startSocial(uid: string | null) {
  stops.forEach(f => f());
  stops = [];
  social.following = new Set();
  social.streams = [];
  social.taste = {};
  tasteReady = false;
  tastePending = [];
  if (!uid) return;

  stops.push(onSnapshot(query(collection(db, 'follows'), where('from', '==', uid)), snap => {
    social.following = new Set(snap.docs.map(d => d.get('to') as string));
  }, () => {}));

  stops.push(onSnapshot(query(collection(db, 'streams'), where('live', '==', true), limit(50)), snap => {
    social.streams = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Stream);
    learnFaces(social.streams);
  }, () => {}));

  stops.push(onSnapshot(doc(db, 'taste', uid), snap => {
    social.taste = snap.exists() ? (snap.data() as Record<string, number>) : {};
    if (!tasteReady) {
      tasteReady = true;
      const waiting = tastePending;
      tastePending = [];
      waiting.forEach(([t, w]) => nudge(t, w));
    }
  }, () => {}));
}

// ---- taste ------------------------------------------------------------------

let tasteTimer: ReturnType<typeof setTimeout> | undefined;
const nudged = new Set<string>();

/**
 * Moves the subject scores after watching, liking, searching and so on. `once`
 * stops the same view from counting twice.
 */
export function nudge(topics: string[], weight: number, once?: string) {
  const uid = auth.currentUser?.uid;
  if (!uid || !topics.length || !weight) return;
  if (once) {
    if (nudged.has(once)) return;
    nudged.add(once);
  }
  if (!tasteReady) { tastePending.push([topics, weight]); return; }
  social.taste = learn(social.taste, topics, weight) as Record<string, number>;
  clearTimeout(tasteTimer);
  const snapshot = { ...social.taste };
  tasteTimer = setTimeout(() => setDoc(doc(db, 'taste', uid), snapshot).catch(() => {}), 1500);
}

export const nudgePost = (p: Post | Stream | undefined, weight: number, once?: string) =>
  p && nudge(topicsOf(p) as string[], weight, once);
export const nudgeText = (text: string, weight: number, once?: string) => nudge(topicsOfText(text) as string[], weight, once);
export { WEIGHT };

// ---- following -----------------------------------------------------------------

/** The address of someone's page: their name when it is known, else their id. */
export function userHref(p: { uid?: string } | null | undefined) {
  const f = p && p.uid ? faces[p.uid] : undefined;
  return '#/u/' + encodeURIComponent((f && f.username) || (p && p.uid) || '');
}


export async function toggleFollow(uid: string) {
  const me = auth.currentUser?.uid;
  if (!me || !uid || uid === me) return;
  const ref = doc(db, 'follows', `${me}_${uid}`);
  const was = social.following.has(uid);
  const next = new Set(social.following);
  if (was) next.delete(uid); else next.add(uid);
  social.following = next;           // shown at once; the listener confirms
  try {
    if (was) await deleteDoc(ref);
    else await setDoc(ref, { from: me, to: uid, at: serverTimestamp() });
  } catch (e) {
    const back = new Set(social.following);
    if (was) back.add(uid); else back.delete(uid);
    social.following = back;
    throw e;
  }
}

/** A name from an address, or an id, to an account id. */
export async function resolveUser(arg: string) {
  const key = arg.trim().toLowerCase();
  if (!key) return null;
  for (const [uid, f] of Object.entries(faces)) {
    if (f.username && f.username.toLowerCase() === key) return uid;
  }
  try {
    const s = await getDoc(doc(db, 'usernames', key));
    if (s.exists()) return s.get('uid') as string;
  } catch { /* perhaps an id */ }
  return arg.trim();
}

export async function loadUser(uid: string) {
  const [p, list, followers, following] = await Promise.all([
    getDoc(doc(db, 'profiles', uid)).catch(() => null),
    getDocs(query(collection(db, 'posts'), where('uid', '==', uid), limit(120))).catch(() => null),
    getCountFromServer(query(collection(db, 'follows'), where('to', '==', uid))).then(c => c.data().count).catch(() => 0),
    getCountFromServer(query(collection(db, 'follows'), where('from', '==', uid))).then(c => c.data().count).catch(() => 0),
  ]);
  const posts = (list ? list.docs.map(d => ({ id: d.id, ...d.data() }) as Post) : [])
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
  return { profile: (p && p.exists() ? p.data() : {}) as Record<string, any>, posts, followers, following };
}

/** A post by id, for one older than the feed's latest. */
export async function loadPost(id: string) {
  const s = await getDoc(doc(db, 'posts', id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Post) : null;
}

// ---- votes on streams -------------------------------------------------------------

export async function voteStream(id: string, want: 1 | -1) {
  const u = auth.currentUser;
  if (!u) return 0;
  const mine = doc(db, 'streams', id, 'votes', u.uid);
  return runTransaction(db, async tx => {
    const snap = await tx.get(mine);
    const had = snap.exists() ? snap.get('v') || 0 : 0;
    const now = had === want ? 0 : want;
    if (now === had) return now;
    const d = { likeCount: 0, dislikeCount: 0 };
    if (had === 1) d.likeCount -= 1;
    if (had === -1) d.dislikeCount -= 1;
    if (now === 1) d.likeCount += 1;
    if (now === -1) d.dislikeCount += 1;
    if (now === 0) tx.delete(mine);
    else tx.set(mine, { v: now, uid: u.uid, at: serverTimestamp() });
    tx.update(doc(db, 'streams', id), { likeCount: increment(d.likeCount), dislikeCount: increment(d.dislikeCount) });
    return now;
  });
}

export function watchStreamVote(id: string, onChange: (v: number) => void) {
  const u = auth.currentUser;
  if (!u) { onChange(0); return () => {}; }
  return onSnapshot(doc(db, 'streams', id, 'votes', u.uid),
    s => onChange(s.exists() ? s.get('v') || 0 : 0), () => onChange(0));
}

// ---- chat --------------------------------------------------------------------------

function author() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return {
    uid: u.uid,
    authorName: session.profile.username || u.displayName || 'someone',
    authorPhoto: session.profile.photoUrl || u.photoURL || null,
  };
}

export function watchChat(id: string, onChange: (m: ChatMessage[]) => void) {
  return onSnapshot(query(collection(db, 'streams', id, 'chat'), orderBy('at', 'desc'), limit(100)),
    s => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }) as ChatMessage).reverse();
      learnFaces(list);
      onChange(list);
    },
    () => onChange([]));
}

export const sendChat = (id: string, text: string) =>
  addDoc(collection(db, 'streams', id, 'chat'), { ...author(), text: text.trim().slice(0, 300), at: serverTimestamp() });

export const deleteChat = (id: string, msgId: string) => deleteDoc(doc(db, 'streams', id, 'chat', msgId));

export function watchStreamDoc(id: string, onChange: (s: Stream | null) => void) {
  return onSnapshot(doc(db, 'streams', id),
    s => onChange(s.exists() ? ({ id, ...s.data() } as Stream) : null),
    () => onChange(null));
}

// ---- tips --------------------------------------------------------------------------

export const TIP_AMOUNTS = [200, 500, 1000, 2000, 5000];

// A tip is charged on the streamer's own Stripe account, so the card form and
// the confirmation both name that account.
export const tipIntent = async (streamId: string, amount: number, message: string) =>
  (await httpsCallable(functions, 'tipIntent')({ streamId, amount, message })).data as {
    clientSecret: string; intentId: string; account: string; livemode: boolean;
  };

export const tipConfirm = (intentId: string, account: string) =>
  httpsCallable(functions, 'tipConfirm')({ intentId, account });

/** Whether a streamer can be tipped: only the server writes this, once Stripe says so. */
export async function tippable(uid: string) {
  const snap = await getDoc(doc(db, 'payouts', uid)).catch(() => null);
  return !!(snap && snap.exists() && snap.get('ready'));
}

export interface Payouts { hasAccount: boolean; ready: boolean; payoutsEnabled: boolean; needsInfo?: boolean }

// Where a streamer's payout setup stands. Stripe is asked at most once a minute.
let payoutsSeen: { at: number; status: Payouts } | null = null;
export async function payoutsStatus(): Promise<Payouts> {
  if (payoutsSeen && Date.now() - payoutsSeen.at < 60000) return payoutsSeen.status;
  const status = (await httpsCallable(functions, 'payoutsStatus')()).data as Payouts;
  payoutsSeen = { at: Date.now(), status };
  return status;
}

/** Stripe's own page for setting up (or starting again with) where tips are paid. */
export async function payoutsLink(country?: string, restart = false) {
  payoutsSeen = null;
  const res = await httpsCallable(functions, 'payoutsLink')({
    back: 'https://codera-46b86.web.app/#/you', country, restart,
  });
  return (res.data as { url: string }).url;
}

export const payoutsDashboard = async () =>
  ((await httpsCallable(functions, 'payoutsDashboard')()).data as { url: string }).url;

// Where Stripe can pay streamers out. It needs the country first, and for good.
export const PAYOUT_COUNTRIES = 'AE AT AU BE BG BR CA CH CY CZ DE DK EE ES FI FR GB GI GR HK HR HU IE IN IT JP LI LT LU LV MT MX MY NL NO NZ PL PT RO SE SG SI SK TH US'.split(' ');

// ---- going live ---------------------------------------------------------------------

export type Source = 'camera' | 'screen';
export interface Picks { cam: string; mic: string }
interface Mix { stream: MediaStream; use(m: MediaStream): void; current(): MediaStream; stop(): void }

export interface Studio {
  id: string;
  uid: string;
  title: string;
  /** What viewers and the recording receive; the camera or screen behind it can change. */
  mix: Mix;
  source: Source;
  picks: Picks;
  startedAt: number;
  watching: number;
  host: { stop(): void };
  rec: { stop(): Promise<Blob> } | null;
  beat: ReturnType<typeof setInterval>;
  ending?: boolean;
}

/** The stream this app is sending, if any. It outlives page changes. */
export const studio = $state({ now: null as Studio | null, tick: 0, chatOpen: false });

let ticker: ReturnType<typeof setInterval> | undefined;

export async function goLive(title: string, media: MediaStream, source: Source, picks: Picks) {
  const who = author();
  const made = await addDoc(collection(db, 'streams'), {
    ...who,
    title: title.trim().slice(0, 120),
    live: true, watching: 0, likeCount: 0, dislikeCount: 0,
    startedAt: serverTimestamp(), beat: serverTimestamp(), endedAt: null,
  });
  // Viewers and the recording take the mixer's steady output, so the camera,
  // microphone or screen behind it can be switched at any point in the stream.
  const mix = mixer(media) as Mix;
  const s: Studio = {
    id: made.id, uid: who.uid, title: title.trim(), mix, source, picks: { ...picks },
    startedAt: Date.now(), watching: 0,
    host: { stop() {} }, rec: null,
    beat: setInterval(() => updateDoc(doc(db, 'streams', made.id), { beat: serverTimestamp() }).catch(() => {}), 20000),
  };
  s.host = hostStream(db, made.id, mix.stream, {
    onWatching: (n: number) => {
      if (studio.now) studio.now.watching = n;
      updateDoc(doc(db, 'streams', made.id), { watching: n }).catch(() => {});
    },
  });
  s.rec = recorder(mix.stream);
  studio.now = s;
  ticker = setInterval(() => { studio.tick++; }, 1000);
  watchSourceEnd(s);
  window.addEventListener('beforeunload', unload);
  nudgeText(title, WEIGHT.stream);
  return s;
}

/**
 * Puts something else on air without interrupting the stream: another camera
 * (OBS's virtual camera, say), another microphone, or the screen.
 */
export async function switchSource(kind: Source, picks: Partial<Picks> = {}) {
  const s = studio.now;
  if (!s) return;
  const next = { ...s.picks, ...picks };
  const media: MediaStream = await capture(kind, next);
  if (studio.now?.id !== s.id) { media.getTracks().forEach(t => t.stop()); return; }
  s.picks = next;
  s.source = kind;
  s.mix.use(media);
  watchSourceEnd(s);
}

// When a shared screen is stopped from the system's own "stop sharing" bar,
// the stream carries on from the camera instead of ending.
function watchSourceEnd(s: Studio) {
  const track = s.mix.current().getVideoTracks()[0];
  if (!track) return;
  track.addEventListener('ended', () => {
    if (studio.now?.id !== s.id || studio.now.mix.current().getVideoTracks()[0] !== track) return;
    switchSource('camera').catch(() => {});
  });
}

function unload() {
  if (studio.now) updateDoc(doc(db, 'streams', studio.now.id), { live: false, endedAt: serverTimestamp() }).catch(() => {});
}

/** Stops streaming. Hands back the recording, if there is one, for the save question. */
export async function endLive() {
  const s = studio.now;
  if (!s || s.ending) return null;
  s.ending = true;
  clearInterval(s.beat);
  clearInterval(ticker);
  s.host.stop();
  const blob = s.rec ? await s.rec.stop() : null;
  s.mix.stop();
  closeChatWindow();
  window.removeEventListener('beforeunload', unload);
  await updateDoc(doc(db, 'streams', s.id), { live: false, endedAt: serverTimestamp(), watching: 0 }).catch(() => {});
  studio.now = null;
  return { id: s.id, title: s.title, blob: blob && blob.size ? blob : null, secs: Math.max(1, Math.round((Date.now() - s.startedAt) / 1000)) };
}

export const dropStream = (id: string) => deleteDoc(doc(db, 'streams', id)).catch(() => {});

/** Keeps a finished stream: uploads the recording and posts it as a saved stream. */
export async function saveStream(id: string, title: string, blob: Blob, secs: number, onProgress: (f: number) => void) {
  const who = author();
  const kind = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const path = `videos/${who.uid}/live-${id}.${kind}`;
  const videoUrl = await new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType: blob.type || 'video/webm' });
    task.on('state_changed',
      s => s.totalBytes && onProgress(s.bytesTransferred / s.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(ref(storage, path))));
  });
  await addDoc(collection(db, 'posts'), {
    ...who, type: 'live', title, description: null, videoUrl, videoPath: path, duration: secs,
    likeCount: 0, dislikeCount: 0, commentCount: 0, createdAt: serverTimestamp(),
  });
  dropStream(id);
}

// ---- the pop-out chat ----------------------------------------------------------------

/**
 * The stream's chat in a window of its own, to keep beside OBS or a game
 * while the main window shows something else.
 */
export async function popOutChat(streamId: string) {
  const hash = `#/chat/${encodeURIComponent(streamId)}`;
  if (!inTauri) {
    window.open(location.origin + location.pathname + hash, 'codera-chat', 'popup,width=420,height=720');
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel('chat');
  if (existing) { await existing.setFocus(); return; }
  const w = new WebviewWindow('chat', {
    url: 'index.html' + hash,
    title: 'Codera — stream chat',
    width: 420,
    height: 720,
    minWidth: 320,
    minHeight: 360,
    decorations: navigator.userAgent.includes('Mac'),
    shadow: true,
    resizable: true,
    useHttpsScheme: true,
  });
  studio.chatOpen = true;
  w.once('tauri://destroyed', () => { studio.chatOpen = false; });
}

export async function closeChatWindow() {
  if (!inTauri) return;
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  (await WebviewWindow.getByLabel('chat'))?.close();
  studio.chatOpen = false;
}
