import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _messaging: Messaging | null = null;

if (isFirebaseConfigured) {
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);
  // Messaging is only supported in browser contexts (not SSR / service worker).
  isSupported().then((supported) => {
    if (supported && app) _messaging = getMessaging(app);
  }).catch(() => {});
} else if (typeof window !== 'undefined') {
  console.warn(
    '[SkillPath] Firebase env vars missing. Copy .env.example to .env.local and fill in your Firebase project keys.'
  );
}

export const auth = _auth as Auth;
export const db = _db as Firestore;
export { app };
export function getFirebaseMessaging(): Messaging | null { return _messaging; }
