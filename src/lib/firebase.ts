import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from "firebase/app-check";

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
/*
 * Two providers, because there are two ways to get a site key and one of them
 * is far easier to obtain.
 *
 * reCAPTCHA Enterprise is a Google Cloud product: the API has to be enabled on
 * the project and it requires billing, which is why it does not appear under
 * Security in a console where it was never switched on.
 *
 * reCAPTCHA v3 needs none of that. The key is created at
 * google.com/recaptcha/admin, is free, and App Check accepts it as a first-
 * class provider. For attesting a storefront it is the same control: a token
 * the genuine app can mint and a copied key cannot.
 *
 * Enterprise wins when both are set, since it is the stronger signal, but
 * either one closes the finding.
 */
const ENTERPRISE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
const V3_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;

/** True when App Check has a site key to attest with, from either provider. */
export const isAppCheckConfigured = Boolean(ENTERPRISE_KEY || V3_KEY);

if (firebaseApp && typeof window !== "undefined" && (ENTERPRISE_KEY || V3_KEY)) {
  try {
    const provider = ENTERPRISE_KEY
      ? new ReCaptchaEnterpriseProvider(ENTERPRISE_KEY)
      : new ReCaptchaV3Provider(V3_KEY as string);
    initializeAppCheck(firebaseApp, {
      provider,
      /* Refresh the token in the background so a long session does not start
         failing attestation part-way through a checkout. */
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Never block sign-in on attestation setup.
    console.error("[firebase] App Check init failed; continuing unattested:", err);
  }
}

/* getAuth AFTER App Check.
 *
 * Firebase requires App Check to initialise before any other service, so the
 * attestation provider is in place when Auth makes its first call. It was
 * below `getAuth` before, which is the wrong order and would have left early
 * auth requests unattested the moment enforcement went on. */
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
