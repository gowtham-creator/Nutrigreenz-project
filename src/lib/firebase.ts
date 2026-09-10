import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

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

/* ── App Check ─────────────────────────────────────────────────────────────
 *
 * ── What this answers ─────────────────────────────────────────────────────
 *
 * The Firebase Web API key is public by design: the browser SDK needs it to
 * address the right project, so it ships in the bundle and no amount of
 * obfuscation changes what goes over the wire. Entersoft reported it twice as
 * "API Key Disclosure in JavaScript File", and origin restrictions alone did
 * not satisfy them.
 *
 * App Check is the control that actually changes the picture. reCAPTCHA
 * Enterprise attests that a request came from THIS app in a real browser, and
 * Firebase rejects requests without a valid attestation token. A key copied out
 * of the bundle and replayed from a script cannot produce one, so the key stops
 * being worth stealing rather than merely being restricted.
 *
 * ── Why this is inert until a site key exists ─────────────────────────────
 *
 * Enforcement is switched on in the Firebase console, NOT here. Turning it on
 * before every client is sending tokens locks real customers out of sign-in, so
 * the sequence is: ship this, watch the App Check dashboard until traffic shows
 * as verified, and only then enforce. With no site key configured this block
 * does nothing at all and auth behaves exactly as before.
 *
 * ── Why failures are swallowed ────────────────────────────────────────────
 *
 * An App Check failure must never be the reason a customer cannot sign in. If
 * initialisation throws, the app continues unattested; the console decides
 * whether unattested requests are allowed, which is the correct place for that
 * decision to live.
 */
const APP_CHECK_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;

/** True when App Check has a site key to attest with. */
export const isAppCheckConfigured = Boolean(APP_CHECK_SITE_KEY);

if (firebaseApp && APP_CHECK_SITE_KEY && typeof window !== "undefined") {
  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
      /* Refresh the token in the background so a long session does not start
         failing attestation part-way through a checkout. */
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Never block sign-in on attestation setup.
    console.error("[firebase] App Check init failed; continuing unattested:", err);
  }
}
