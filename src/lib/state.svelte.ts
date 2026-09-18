import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query, type Timestamp,
} from 'firebase/firestore';

import { auth, db } from './firebase';
import { notify } from './native';
import { startSocial } from './social.svelte';

export type Kind = 'post' | 'short' | 'video' | 'live';

export interface Post {
  id: string;
  type: Kind;
  uid: string;
  authorName: string;
  authorPhoto: string | null;
  title: string;
  body?: string;
  code?: string;
  lang?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  videoUrl?: string;
  videoPath?: string;
  duration?: number | null;
  description?: string | null;
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  createdAt?: Timestamp;
}

export interface Profile {
  username?: string;
  bio?: string | null;
  photoUrl?: string | null;
  photoPath?: string | null;
  bannerUrl?: string | null;
  bannerPath?: string | null;
  bannerY?: number;
}

export interface Plus {
  loading: boolean;
  active: boolean;
  cancelled: boolean;
  endsAt: number;
}

/**
 * Everything the signed-in person's Codera is made of, live.
 *
 * One place, filled by Firestore listeners, that every screen reads from — so a
 * like on the phone, a new post on the website or a Plus payment all show up
 * here without anything asking.
 */
export const session = $state({
  ready: false,
  user: null as User | null,
  profile: {} as Profile,
  profileReady: false,
  plus: { loading: true, active: false, cancelled: false, endsAt: 0 } as Plus,
  posts: [] as Post[],
  postsReady: false,
});

/**
 * The name and picture each author is wearing now. A post carries a copy from
 * the moment it was written; this is what keeps old posts from showing an old
 * picture after someone changes theirs.
 */
export const faces: Record<string, { username?: string; photoUrl?: string | null }> = $state({});

export function face(p: { uid?: string; authorName?: string; authorPhoto?: string | null }) {
  const f = p.uid ? faces[p.uid] : undefined;
  return {
    name: f?.username || p.authorName || 'someone',
    photo: f?.photoUrl || p.authorPhoto || null,
  };
}

export function learnFaces(list: { uid?: string }[]) {
  const missing = [...new Set(list.map(x => x.uid).filter(Boolean) as string[])]
    .filter(uid => !(uid in faces));
  for (const uid of missing) {
    faces[uid] = {};
    getDoc(doc(db, 'profiles', uid))
      .then(s => { if (s.exists()) faces[uid] = { username: s.get('username'), photoUrl: s.get('photoUrl') }; })
      .catch(() => { /* the post's own copy stands */ });
  }
}

let stop: (() => void)[] = [];

/** Starts listening. Called once, when the app opens. */
export function startSession() {
  onAuthStateChanged(auth, user => {
    stop.forEach(f => f());
    stop = [];
    session.user = user;
    session.profile = {};
    session.profileReady = false;
    session.posts = [];
    session.postsReady = false;
    session.plus = { loading: true, active: false, cancelled: false, endsAt: 0 };
    session.ready = true;
    startSocial(user ? user.uid : null);
    if (!user) return;

    const seen = new Set<string>();
    let first = true;

    stop.push(onSnapshot(
      query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(150)),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post);

        // Someone else posted while Codera was open but not in front: say so,
        // the way a desktop app should, rather than waiting to be looked at.
        if (!first && document.hidden) {
          for (const p of list) {
            if (!seen.has(p.id) && p.uid !== user.uid && p.type !== 'post') {
              notify(`New ${p.type} on Codera`, `${face(p).name}: ${p.title}`);
            }
          }
        }
        list.forEach(p => seen.add(p.id));
        first = false;

        session.posts = list;
        session.postsReady = true;
        learnFaces(list);
      },
      () => { session.postsReady = true; },
    ));

    stop.push(onSnapshot(doc(db, 'profiles', user.uid), snap => {
      session.profile = snap.exists() ? (snap.data() as Profile) : {};
      session.profileReady = true;
      faces[user.uid] = { username: session.profile.username, photoUrl: session.profile.photoUrl };
    }, () => { session.profileReady = true; }));

    stop.push(onSnapshot(doc(db, 'users', user.uid), snap => {
      const p = snap.get('plus');
      const endsAt = p?.endsAt?.toMillis ? p.endsAt.toMillis() : 0;
      const running = !!p?.active && endsAt > Date.now();
      session.plus = { loading: false, active: running, cancelled: running && !!p.cancelled, endsAt };
    }, () => { session.plus = { loading: false, active: false, cancelled: false, endsAt: 0 }; }));
  });
}

export const me = () => session.user;
export const myName = () => session.profile.username || session.user?.displayName || 'you';
export const myPhoto = () => session.profile.photoUrl || session.user?.photoURL || null;
