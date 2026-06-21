/**
 * Server-side Firebase Admin — used ONLY to verify Firebase ID tokens that the
 * client obtains after a sign-in (e.g. admin phone-OTP). Credentials come from
 * the service-account env vars (never the NEXT_PUBLIC_* client config).
 *
 * Fails closed: when the service-account env vars are absent, `isAdminConfigured`
 * is false and `verifyIdToken` throws a clear error rather than trusting input.
 *
 * Node runtime only (firebase-admin is not Edge-compatible) — import this from
 * Node route handlers, never from `proxy.ts` or middleware.
 */
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Private keys are stored in env with literal "\n" sequences; restore real newlines.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

/** True when the Admin SDK service-account credentials are present. */
export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey);

let app: App | null = null;

function adminApp(): App {
  if (!isAdminConfigured) {
    throw new Error("Firebase Admin is not configured (set FIREBASE_* env vars).");
  }
  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return app;
}

/**
 * Verify a Firebase ID token and return its decoded claims, or throw if the
 * token is missing/expired/invalid or the Admin SDK isn't configured.
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAuth(adminApp()).verifyIdToken(idToken);
}
