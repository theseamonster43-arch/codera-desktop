import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from './firebase';

/**
 * The rules that keep Codera from being somewhere a child gets hurt: where it
 * is open at all, who you have blocked, reporting, what can't be said in a
 * comment, and the age behind the links on a profile.
 *
 * Every rule here is the website's rule, to the letter — the same host lists,
 * the same wording, the same collections — because a rule that only holds on
 * one client isn't a rule, it's a detour. web/app.js and the Android app's
 * src/safety.js are the other two copies, and a check in the Codera repo
 * compares the lists across all three.
 */

// ---- where Codera is open ----------------------------------------------------------

// Australia set a minimum age of 16 for social platforms in December 2025, and
// the platform carries the penalty. Whether a place for learning to code is
// caught by that turns on an exemption nobody has ruled on for us, so Codera
// stays out until someone qualified says otherwise.
const SHUT: Record<string, { where: string; zones: RegExp }> = {
  AU: { where: 'Australia', zones: /^Australia\//i },
};

// The clock only. The language a browser is set to was in here too and it was
// wrong: an Australian living anywhere else still has en-AU, and would be shut
// out of a country they are not in. What someone's language says about them is
// who they are, not where they are.
export function shutHere() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* older engine */ }
  for (const code of Object.keys(SHUT)) {
    if (SHUT[code].zones.test(zone)) return SHUT[code];
  }
  return null;
}

// ---- how old someone is ------------------------------------------------------------

export const MIN_AGE = 13;
export const ADULT_AGE = 18;
export const CHECKS_OPEN = true;

export const safety = $state({
  blocked: new Set<string>(),
  adultAt: null as number | null,
  by: null as string | null,
});

/** Old enough, and checked by somebody other than themselves. */
export function isAdult() {
  return safety.by !== null && safety.by !== 'self'
    && safety.adultAt !== null && Date.now() >= safety.adultAt;
}

let stopBlocks: (() => void) | null = null;
let stopAge: (() => void) | null = null;

/** Starts and stops with whoever is signed in. */
export function startSafety(uid: string | null) {
  stopBlocks?.();
  stopAge?.();
  stopBlocks = null;
  stopAge = null;
  safety.blocked = new Set();
  safety.adultAt = null;
  safety.by = null;
  if (!uid) return;

  stopBlocks = onSnapshot(
    query(collection(db, 'blocks'), where('from', '==', uid)),
    snap => { safety.blocked = new Set(snap.docs.map(d => d.get('to') as string)); },
    () => {},
  );
  stopAge = onSnapshot(doc(db, 'ages', uid), snap => {
    const at = snap.get('adultAt');
    safety.adultAt = typeof at === 'number' ? at : null;
    safety.by = snap.exists() ? ((snap.get('by') as string) || null) : null;
  }, () => {});
}

/** Sends someone to the page that does the checking. */
export async function startAgeCheck() {
  const res = await httpsCallable<unknown, { url: string }>(functions, 'ageStart')();
  return res.data.url;
}

// ---- blocking and reporting --------------------------------------------------------

export async function toggleBlock(uid: string) {
  const me = auth.currentUser?.uid;
  if (!me || !uid || me === uid) return;
  const id = `${me}_${uid}`;
  if (safety.blocked.has(uid)) {
    await deleteDoc(doc(db, 'blocks', id));
    return;
  }
  await setDoc(doc(db, 'blocks', id), { from: me, to: uid, at: serverTimestamp() });
}

export const REASONS = [
  { id: 'child', label: 'A child is in danger' },
  { id: 'sexual', label: 'Sexual content' },
  { id: 'violence', label: 'Violence or self-harm' },
  { id: 'hate', label: 'Hate or harassment' },
  { id: 'offtopic', label: 'Nothing to do with learning' },
  { id: 'spam', label: 'Spam or a scam' },
];

export async function report(kind: string, target: string, about: string | null, reason: string) {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await setDoc(doc(db, 'reports', `${target}_${me}`), {
    kind, target, about: about || null, by: me, reason, at: serverTimestamp(),
  });
}

// ---- what can't be said in a comment -----------------------------------------------

const PUBLIC_PLACES = [
  'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
  'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'linkedin.com', 'mastodon.social',
  'dev.to', 'medium.com', 'npmjs.com', 'pypi.org', 'codepen.io', 'replit.com',
  'instagram.com', 'tiktok.com', 'twitch.tv', 'reddit.com', 'bsky.app', 'threads.net',
  'patreon.com', 'ko-fi.com', 'buymeacoffee.com', 'substack.com',
  'codesandbox.io', 'figma.com', 'notion.site', 'docs.google.com', 'developer.mozilla.org',
  'learncodera.com', 'codera-46b86.web.app',
];

const PRIVATE_CHANNELS = [
  /\b(?:discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\b/i,
  /\b(?:t\.me|telegram\.me|wa\.me|api\.whatsapp\.com|ig\.me|m\.me|snapchat\.com\/add|join\.skype\.com)\b/i,
  /\b(?:discord|telegram|whatsapp|snap(?:chat)?|kik|signal|skype)\b\s*(?:is|:|@|=|->)\s*\S+/i,
  /\b(?:add|dm|pm|message)\s+me\s+on\b/i,
];

export const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
export const PHONE = /(?:\d[\s().-]?){7,}/;

function hostsIn(text: string) {
  const found: string[] = [];
  const links = text.match(/(?:https?:\/\/|www\.)[^\s<>"']+/gi) || [];
  for (const link of links) {
    try {
      found.push(new URL(link.startsWith('http') ? link : `https://${link}`)
        .hostname.replace(/^www\./, ''));
    } catch { found.push(link); }
  }
  return found;
}

/**
 * Why this can't be sent, or '' when it can. `theirs` is true when the person
 * writing owns the room — their post, their stream — so a teacher may point at
 * their own community. Phone numbers and emails are refused from everyone.
 */
export function contactProblem(text: string, theirs: boolean) {
  if (EMAIL.test(text)) return 'Email addresses can’t be shared in chat or comments.';
  if (PHONE.test(text.replace(/\b\d{1,4}px\b|\b0x[0-9a-f]+\b/gi, ''))) {
    return 'Phone numbers can’t be shared in chat or comments.';
  }
  if (!theirs && PRIVATE_CHANNELS.some(p => p.test(text))) {
    return 'Codera doesn’t allow invites to private messaging apps — that’s how people get led somewhere unsafe. Your GitHub, channel or website is fine.';
  }
  const strangers = theirs ? [] : hostsIn(text)
    .filter(h => !PUBLIC_PLACES.some(ok => h === ok || h.endsWith(`.${ok}`)));
  if (strangers.length) {
    return 'Only links to public places like GitHub, YouTube or Stack Overflow can go in chat and comments. Put anything else in your profile or the description.';
  }
  return '';
}

// ---- where else someone can be found -----------------------------------------------

export const MAX_LINKS = 5;

const DM_LINKS = [
  /^m\.me$/i, /^ig\.me$/i, /^wa\.me$/i, /^api\.whatsapp\.com$/i,
  /^chat\.whatsapp\.com$/i, /^join\.skype\.com$/i, /^snapchat\.com$/i,
];
const DM_PATHS = [/^\/\+/, /^\/joinchat/i, /^\/add\b/i, /^\/users\//i, /^\/m\//i];
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly',
  'rb.gy', 'shorturl.at', 'rebrand.ly', 'ow.ly', 'lnkd.in', 'linktr.ee'];

export const SOCIALS = [
  { key: 'youtube', hosts: ['youtube.com', 'youtu.be'], name: 'YouTube', at: true },
  { key: 'x', hosts: ['x.com', 'twitter.com'], name: 'X', at: true },
  { key: 'instagram', hosts: ['instagram.com'], name: 'Instagram', at: true },
  { key: 'tiktok', hosts: ['tiktok.com'], name: 'TikTok', at: true },
  { key: 'twitch', hosts: ['twitch.tv'], name: 'Twitch', at: true },
  { key: 'github', hosts: ['github.com'], name: 'GitHub', at: false },
  { key: 'gitlab', hosts: ['gitlab.com'], name: 'GitLab', at: false },
  { key: 'linkedin', hosts: ['linkedin.com'], name: 'LinkedIn', at: false },
  { key: 'discord', hosts: ['discord.gg', 'discord.com', 'discordapp.com'], name: 'Discord', at: false },
  { key: 'reddit', hosts: ['reddit.com'], name: 'Reddit', at: false },
  { key: 'bluesky', hosts: ['bsky.app'], name: 'Bluesky', at: true },
  { key: 'mastodon', hosts: ['mastodon.social', 'fosstodon.org', 'hachyderm.io'], name: 'Mastodon', at: true },
  { key: 'patreon', hosts: ['patreon.com'], name: 'Patreon', at: false },
  { key: 'kofi', hosts: ['ko-fi.com', 'buymeacoffee.com'], name: 'Tip jar', at: false },
  { key: 'substack', hosts: ['substack.com'], name: 'Substack', at: false },
];

export function asUrl(raw: string) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
    return u;
  } catch { return null; }
}

export function placeFor(host: string) {
  return SOCIALS.find(s => s.hosts.some(h => host === h || host.endsWith(`.${h}`))) || null;
}

/** Why this can't go on a profile, or '' when it can. */
export function linkProblem(raw: string) {
  const text = String(raw || '').trim();
  if (!text) return 'Put a link in, or remove the empty row.';
  if (text.length > 200) return 'That link is too long.';
  if (EMAIL.test(text)) return 'This is for links. An email address can’t go on a Codera profile.';
  if (PHONE.test(text.replace(/\b\d{1,4}px\b|\b0x[0-9a-f]+\b/gi, ''))) {
    return 'This is for links. A phone number can’t go on a Codera profile.';
  }
  const u = asUrl(text);
  if (!u) return `“${text.slice(0, 40)}” doesn’t look like a link.`;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (SHORTENERS.includes(host)) return 'Shortened links hide where they go. Use the real address.';
  const dmHost = DM_LINKS.some(p => p.test(host));
  const dmPath = DM_PATHS.some(p => p.test(u.pathname));
  if (dmHost || (dmPath && /^(t\.me|telegram\.me|discord\.com|discordapp\.com)$/i.test(host))) {
    return 'That link opens a private message with you. A channel, a server or a page is fine — a direct line to one person isn’t.';
  }
  return '';
}

export function handleFor(u: URL, place: { at: boolean; name: string }) {
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const first = u.pathname.split('/').filter(Boolean)[0] || '';
  if (!place) return host;
  if (!first) return place.name;
  const clean = first.replace(/^@/, '');
  if (/^(c|channel|user|in|company|invite|r|watch|playlist)$/i.test(clean)) {
    const next = u.pathname.split('/').filter(Boolean)[1];
    if (!next) return place.name;
    return clean.toLowerCase() === 'r' ? `r/${next}` : next.replace(/^@/, '');
  }
  return place.at ? `@${clean}` : clean;
}

export async function setLinks(list: string[]) {
  await setDoc(doc(db, 'profiles', auth.currentUser!.uid), {
    links: list.length ? list.slice(0, MAX_LINKS) : null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function chipsFor(links: unknown) {
  return (Array.isArray(links) ? links : []).slice(0, MAX_LINKS).map(raw => {
    const u = asUrl(raw as string);
    if (!u) return null;
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const place = placeFor(host);
    return {
      href: u.href,
      key: place ? place.key : 'web',
      text: place ? handleFor(u, place) : host,
    };
  }).filter(Boolean) as { href: string; key: string; text: string }[];
}

// ---- a description points nowhere either -------------------------------------------

// Gate the links row at 18 and leave "my IG is @me" sitting in a bio, and the
// gate means nothing. Nothing is edited: the words stay as they were written,
// and a reader who isn't a checked adult is simply not shown the part that
// leads away.
const TLDS = 'com|net|org|io|dev|app|co|me|tv|gg|social|xyz|site|link|page|sh|ai|so'
  + '|to|gl|be|uk|us|ca|de|fr|in|club|live|online|store|blog|email|chat';
const LINKISH = new RegExp(
  '(?:https?:\\/\\/|www\\.)[^\\s]+'
  + `|\\b(?:[a-z0-9-]+\\.)+(?:${TLDS})\\b(?:\\/[^\\s]*)?`, 'gi');
const EMAIL_ALL = new RegExp(EMAIL.source, 'gi');
const PHONE_ALL = new RegExp(PHONE.source, 'g');

/** A bio split into the parts to show and the parts to hide. */
export function bioParts(text: string | null | undefined, show: boolean) {
  const raw = String(text || '');
  if (show || !raw) return [{ text: raw, hidden: false }];
  const HOLE = '\u0000';
  const masked = raw
    .replace(EMAIL_ALL, HOLE)
    .replace(PHONE_ALL, HOLE)
    .replace(LINKISH, HOLE)
    .replace(new RegExp(`${HOLE}[\\s,·|/-]*${HOLE}`, 'g'), HOLE);
  const out: { text: string; hidden: boolean }[] = [];
  masked.split(HOLE).forEach((piece, i) => {
    if (i) out.push({ text: 'link hidden', hidden: true });
    if (piece) out.push({ text: piece, hidden: false });
  });
  return out;
}

export function bioPoints(text: string | null | undefined) {
  const raw = String(text || '');
  EMAIL_ALL.lastIndex = 0; PHONE_ALL.lastIndex = 0; LINKISH.lastIndex = 0;
  return EMAIL_ALL.test(raw) || PHONE_ALL.test(raw) || LINKISH.test(raw);
}
