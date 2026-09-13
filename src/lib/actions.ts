import { updateProfile } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, increment, limit, onSnapshot, orderBy,
  query, runTransaction, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions, storage } from './firebase';
import { session, type Post } from './state.svelte';

/**
 * Everything Codera writes. The shapes match the app and the website exactly:
 * the database rules name every field a post may have, and refuse the rest.
 */

function author() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return {
    uid: u.uid,
    authorName: session.profile.username || u.displayName || (u.email ? u.email.split('@')[0] : 'someone'),
    authorPhoto: session.profile.photoUrl || u.photoURL || null,
  };
}

function uploadTo(path: string, file: File, onProgress?: (f: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
    task.on('state_changed',
      s => onProgress && s.totalBytes && onProgress(s.bytesTransferred / s.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(ref(storage, path))));
  });
}

const ext = (file: File, fallback: string) => (file.type && file.type.split('/')[1]) || fallback;

// ---- posting ----------------------------------------------------------------

export async function createPost(p: {
  title: string; body: string; code: string; lang: string | null; image: File | null;
  onProgress?: (f: number) => void;
}) {
  const who = author();
  let imageUrl: string | null = null;
  let imagePath: string | null = null;
  // The picture goes up first: a post is never written pointing at nothing.
  if (p.image) {
    imagePath = `images/${who.uid}/${Date.now()}.${ext(p.image, 'jpg')}`;
    imageUrl = await uploadTo(imagePath, p.image, p.onProgress);
  }
  return addDoc(collection(db, 'posts'), {
    ...who,
    type: 'post',
    title: p.title.trim(),
    body: (p.body || '').trim(),
    code: (p.code || '').replace(/\s+$/, ''),
    lang: p.lang || null,
    imageUrl, imagePath,
    likeCount: 0, dislikeCount: 0, commentCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function uploadVideo(p: {
  file: File; kind: 'short' | 'video'; title: string; description: string; duration: number;
  onProgress?: (f: number) => void;
}) {
  const who = author();
  const path = `videos/${who.uid}/${Date.now()}.${ext(p.file, 'mp4')}`;
  const videoUrl = await uploadTo(path, p.file, p.onProgress);
  return addDoc(collection(db, 'posts'), {
    ...who,
    type: p.kind,
    title: p.title.trim(),
    description: (p.description || '').trim() || null,
    videoUrl, videoPath: path,
    duration: p.duration || null,
    likeCount: 0, dislikeCount: 0, commentCount: 0,
    createdAt: serverTimestamp(),
  });
}

export async function deletePost(p: Post) {
  // The file may already be gone; that must not keep the post alive.
  for (const path of [p.videoPath, p.imagePath]) {
    if (path) { try { await deleteObject(ref(storage, path)); } catch { /* gone */ } }
  }
  await deleteDoc(doc(db, 'posts', p.id));
}

// ---- likes and comments -------------------------------------------------------

const voteRef = (postId: string, uid: string) => doc(db, 'posts', postId, 'votes', uid);

/** One vote per person; pressing the same one again takes it back. */
export async function vote(postId: string, want: 1 | -1) {
  const u = auth.currentUser;
  if (!u) return;
  await runTransaction(db, async tx => {
    const mine = await tx.get(voteRef(postId, u.uid));
    const had = mine.exists() ? mine.get('v') || 0 : 0;
    const now = had === want ? 0 : want;
    if (now === had) return;
    const d = { likeCount: 0, dislikeCount: 0 };
    if (had === 1) d.likeCount -= 1;
    if (had === -1) d.dislikeCount -= 1;
    if (now === 1) d.likeCount += 1;
    if (now === -1) d.dislikeCount += 1;
    if (now === 0) tx.delete(voteRef(postId, u.uid));
    else tx.set(voteRef(postId, u.uid), { v: now, uid: u.uid, at: serverTimestamp() });
    tx.update(doc(db, 'posts', postId), {
      likeCount: increment(d.likeCount), dislikeCount: increment(d.dislikeCount),
    });
  });
}

export function watchMyVote(postId: string, onChange: (v: number) => void) {
  const u = auth.currentUser;
  if (!u) { onChange(0); return () => {}; }
  return onSnapshot(voteRef(postId, u.uid),
    s => onChange(s.exists() ? s.get('v') || 0 : 0), () => onChange(0));
}

export interface Comment {
  id: string; uid: string; authorName: string; authorPhoto: string | null; text: string; createdAt?: any;
}

export function watchComments(postId: string, onChange: (c: Comment[]) => void) {
  return onSnapshot(
    query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(200)),
    s => onChange(s.docs.map(d => ({ id: d.id, ...d.data() }) as Comment)),
    () => onChange([]));
}

export async function addComment(postId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  await addDoc(collection(db, 'posts', postId, 'comments'), {
    ...author(), text: body.slice(0, 1000), createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
}

export async function deleteComment(postId: string, id: string) {
  await deleteDoc(doc(db, 'posts', postId, 'comments', id));
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(-1) });
}

// ---- your page ---------------------------------------------------------------------

export async function setProfileImage(kind: 'banner' | 'photo', file: File) {
  const uid = auth.currentUser!.uid;
  const path = `profile/${uid}/${kind}-${Date.now()}.${ext(file, 'jpg')}`;
  const url = await uploadTo(path, file);
  const was = kind === 'banner' ? session.profile.bannerPath : session.profile.photoPath;
  await setDoc(doc(db, 'profiles', uid), {
    [kind + 'Url']: url, [kind + 'Path']: path, updatedAt: serverTimestamp(),
  }, { merge: true });
  if (kind === 'photo') await updateProfile(auth.currentUser!, { photoURL: url });
  if (was) { try { await deleteObject(ref(storage, was)); } catch { /* gone */ } }
}

export async function setBio(text: string) {
  await setDoc(doc(db, 'profiles', auth.currentUser!.uid), {
    bio: text.trim().slice(0, 300) || null, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export const NAME_OK = /^[a-z0-9_]{3,20}$/;
export const nameKey = (raw: string) => String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');

export async function nameFree(raw: string) {
  return !(await getDoc(doc(db, 'usernames', nameKey(raw)))).exists();
}

/** The claim is a document named after the name, which the rules only let be created once. */
export async function claimUsername(raw: string) {
  const key = nameKey(raw);
  if (!NAME_OK.test(key)) throw new Error('shape');
  const uid = auth.currentUser!.uid;
  await setDoc(doc(db, 'usernames', key), { uid, at: serverTimestamp() });
  await setDoc(doc(db, 'profiles', uid), { username: key, updatedAt: serverTimestamp() }, { merge: true });
  await updateProfile(auth.currentUser!, { displayName: key });
}

// ---- Plus ------------------------------------------------------------------------------

/** A payment to take now, or — inside a month already paid for — a card to save for later. */
export const plusIntent = async () =>
  (await httpsCallable(functions, 'plusIntent')()).data as {
    clientSecret?: string; setupSecret?: string; startsAt?: number; livemode: boolean;
  };

export const plusCard = async () =>
  (await httpsCallable(functions, 'plusCard')()).data as {
    setupSecret: string; setupIntentId: string; livemode: boolean;
  };

export const plusCardSave = (setupIntentId: string) =>
  httpsCallable(functions, 'plusCardSave')({ setupIntentId });

export const plusCancel = () => httpsCallable(functions, 'plusCancel')();
