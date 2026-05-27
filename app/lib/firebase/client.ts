/**
 * Firebase client initialization. Reads from NEXT_PUBLIC_FIREBASE_* env vars.
 *
 * When env vars are missing (e.g. local dev without a .env.local), Firebase is
 * disabled and the app falls back to the in-memory mock repo + the fake login
 * flow. This keeps `npm run dev` working with zero Firebase configuration.
 *
 * NOTE: The Firebase web config values are public — they identify the project,
 * they aren't secrets. Real security comes from Firestore security rules and
 * the Auth provider configuration in the Firebase console.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True if the minimum required Firebase config is present. */
export function isFirebaseEnabled(): boolean {
  return !!(config.apiKey && config.projectId && config.appId);
}

let _app: FirebaseApp | null = null;
function getApp(): FirebaseApp | null {
  if (!isFirebaseEnabled()) return null;
  if (_app) return _app;
  _app = getApps().length > 0
    ? getApps()[0]!
    : initializeApp(config as Required<typeof config>);
  return _app;
}

let _auth: Auth | null = null;
export function getFirebaseAuth(): Auth | null {
  if (_auth) return _auth;
  const app = getApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}
