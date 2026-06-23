/**
 * Server-side Firebase ID token verification — implemented with `jose` instead
 * of the `firebase-admin` SDK.
 *
 * Why not firebase-admin: its transitive `jwks-rsa` does a CommonJS `require()`
 * of the ESM-only `jose`, which Vercel's Node runtime rejects with
 * `ERR_REQUIRE_ESM` and 500s every route that verifies a token. Verifying the
 * token directly against Google's public JWKS — with `jose` loaded via dynamic
 * `import()` (which handles ESM correctly) — avoids the SDK entirely and needs
 * only the project id (no service-account key, since verification only uses
 * public keys).
 *
 * Node runtime only — import from Node route handlers, never the Edge proxy.
 */
import type { JWTPayload, JWTVerifyGetKey } from "jose";

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/** True when the Firebase project id needed to verify tokens is configured. */
export const isAdminConfigured = Boolean(projectId);

/** The subset of Firebase ID token claims this app relies on. */
export interface DecodedIdToken extends JWTPayload {
  /** Firebase user id (the token `sub`). */
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  phone_number?: string;
  firebase?: { sign_in_provider?: string };
}

/** Google's JWK Set for Firebase ID tokens (RS256). */
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// Cached across invocations; createRemoteJWKSet handles refresh + kid rotation.
let jwks: JWTVerifyGetKey | null = null;

/**
 * Verify a Firebase ID token and return its decoded claims, or throw if the
 * token is missing/expired/invalid or the project id isn't configured. The
 * signature, issuer, audience and expiry are all checked by `jwtVerify`.
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured.");
  }
  const jose = await import("jose");
  if (!jwks) jwks = jose.createRemoteJWKSet(new URL(JWKS_URL));

  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
  });
  if (!payload.sub) throw new Error("Token has no subject.");

  return { ...payload, uid: String(payload.sub) } as DecodedIdToken;
}
