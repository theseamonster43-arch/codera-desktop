import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';

/**
 * Which build this is, and whether it is still allowed to run.
 *
 * A desktop app is the one client that can't be fixed after it ships. Someone
 * running last month's build has last month's rules — it will never know about
 * a country we have closed, or an age check we have added, and no amount of
 * care in this file reaches it. The only thing an old build can't ignore is
 * the database refusing to answer it.
 *
 * So two things happen. Every build stamps `clients/{uid}` with its number on
 * sign-in, which the security rules can then require; and every build watches
 * `config/app` for the lowest number still allowed, so it can bow out with a
 * civil screen instead of a wall of permission errors.
 *
 * Only the second half works on builds that already exist — they don't stamp
 * anything, so when the floor is raised they will simply stop being answered.
 * That is the point, and it is also why the floor must not be raised until a
 * new build has been out long enough for people to have it.
 */

// Raised by one whenever a release carries something the rules depend on.
export const BUILD = 1;

export const build = $state({
  min: 0,          // 0 while no floor is set, so nothing is refused
  outdated: false,
});

/** Tells the database which build is asking, so the rules can decide. */
export async function stamp(uid: string) {
  try {
    await setDoc(doc(db, 'clients', uid), {
      platform: 'desktop', build: BUILD, at: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Refused, most likely because this build is already below the floor. The
    // watcher below is what explains that to the person.
  }
}

let stop: (() => void) | null = null;

export function watchBuild() {
  stop?.();
  stop = onSnapshot(doc(db, 'config', 'app'), snap => {
    const min = snap.get('minDesktop');
    build.min = typeof min === 'number' ? min : 0;
    build.outdated = build.min > BUILD;
  }, () => {
    // Can't read it — say nothing rather than locking someone out of their own
    // app over a dropped connection.
  });
}
