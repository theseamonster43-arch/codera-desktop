import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

/**
 * The same Firebase project as the app and the website: one account, one feed,
 * one set of security rules. None of these values is secret — the key only
 * names the project; sign-in and the rules are what protect an account.
 */
const app = initializeApp({
  apiKey: 'AIzaSyAff6wCaEfD0jOrYI51xbqyXR3jGx6KEd4',
  authDomain: 'codera-46b86.firebaseapp.com',
  projectId: 'codera-46b86',
  storageBucket: 'codera-46b86.firebasestorage.app',
  messagingSenderId: '376496609142',
  appId: '1:376496609142:web:732200bb605656ec288c57',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// The full origin rather than a bare region, which is guessed at differently
// from one JavaScript runtime to the next.
export const functions = getFunctions(app, 'https://us-central1-codera-46b86.cloudfunctions.net');

/**
 * Stripe's publishable keys: public by design, able to start a payment and
 * nothing else. The server says which mode it is in, and the key is picked to
 * match. The secret key never leaves Google Secret Manager.
 */
export const STRIPE_PK = {
  live: 'pk_live_51UEWrl6MmwHJvfDUwlK1NpA8DibVh1As0WA33jyt2SN5RVHvdtiqiYbUPZZEMkuWNy4nbj2k4wHSNxx1Lbh4pAfg00t1oM0YIw',
  test: 'pk_test_51UEWrl6MmwHJvfDUDKvxB0xnxR6xI0CKxFrLeRDCruLRHupCkLFBTLSBT0AhQm6XgHXrx1j84hZVdtJ1v2xR4yF400YEE2TpNO',
};

export const SITE = 'https://learncodera.com';
