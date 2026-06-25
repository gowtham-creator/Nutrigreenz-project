import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase client config — per the Tech Stack doc (§3), auth is Firebase Auth
 * (Google Sign-In + Mobile OTP). Values come from public env vars; add them to
 * `.env.local` (see `.env.example`). All NEXT_PUBLIC_* so they ship to the client.
 *
 * Auth is OPTIONAL at runtime: if the config is absent the app still renders,
 * and auth actions surface a friendly "not configured" error instead of crashing.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the Firebase web config is present. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * The raw web config — exported so a SECONDARY, isolated Firebase app instance
 * can be spun up (e.g. to OTP-verify a phone that already belongs to another
 * account WITHOUT disturbing the primary signed-in session). See
 * `@/components/ng/account/link-phone-prompt`.
 */
export { firebaseConfig };

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
