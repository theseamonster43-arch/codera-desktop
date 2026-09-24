import { GithubAuthProvider, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';

import { auth } from './firebase';
import { openExternal, inTauri } from './native';

/**
 * Signing in with Google or GitHub from the desktop app.
 *
 * Firebase's own popup and redirect both need the page asking to be on a domain
 * the project trusts, and this app is served from inside Tauri — an origin no
 * dashboard can authorise. So the provider's part happens where it can: the
 * system browser, on learncodera.com, on the same hand-off page the phone apps
 * use. What comes back through codera:// is a token from the provider, never a
 * password, and only because this app asked for it.
 *
 * The browser rather than a window of our own, deliberately: neither Google nor
 * GitHub will sign anyone in inside a window the app controls, and a password
 * typed into one would be a password the app could read.
 */

const PAGE = 'https://learncodera.com/auth.html';

/** 24 random bytes, so a reply can be matched to the request that asked for it. */
function freshState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signInThrough(provider: 'google' | 'github') {
  if (!inTauri) throw new Error('This way in is for the desktop app.');

  const state = freshState();

  // Listening before the browser opens: the answer can come back the moment
  // somebody is already signed in to that provider.
  const done = new Promise<URL>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('That sign-in timed out.')), 5 * 60 * 1000);
    onOpenUrl(urls => {
      for (const raw of urls) {
        let url: URL;
        try { url = new URL(raw); } catch { continue; }
        if (url.protocol !== 'codera:') continue;
        clearTimeout(timer);
        resolve(url);
        return;
      }
    }).catch(reject);
  });

  await openExternal(`${PAGE}?provider=${provider}&state=${encodeURIComponent(state)}`);

  const back = await done;
  const from = back.searchParams;

  // The one check that matters: a link that did not come from the request just
  // made is somebody else's link.
  if (from.get('state') !== state) throw new Error("That sign-in didn't match this one. Try again.");
  const complaint = from.get('error');
  if (complaint) throw new Error(complaint);

  const credential = from.get('provider') === 'github'
    ? GithubAuthProvider.credential(from.get('accessToken') || '')
    : GoogleAuthProvider.credential(from.get('idToken'), from.get('accessToken'));

  await signInWithCredential(auth, credential);
}
