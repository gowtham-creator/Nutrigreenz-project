/**
 * Customer session token — Edge-compatible HMAC over the Firebase UID.
 *
 * Mirrors the admin session util: Web Crypto only (no `node:crypto` /
 * `next/headers`), so it can also be imported by the Edge proxy later to guard
 * `/account` and `/checkout`. Cookie reading/writing is left to callers.
 *
 * An `ng_session` cookie is minted ONLY after the server has verified a Firebase
 * ID token, so a valid token proves the bearer signed in as that UID. The signed
 * payload is the bare UID; expiry is enforced by the cookie's `maxAge`.
 *
 * Secret: `SESSION_SECRET`, falling back to `ADMIN_SESSION_SECRET` so it works
 * with the existing setup. Fails closed when no secret is configured.
 *
 * Token format: `${base64url(uid)}.${base64url(HMAC_SHA256(uid, secret))}`
 */
export const NG_SESSION_COOKIE = "ng_session";

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/** Encode bytes as URL-safe base64 (no padding). */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a URL-safe base64 string back to bytes. Returns null on bad input. */
function fromBase64Url(value: string): Uint8Array | null {
  try {
    let b64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Mint a signed session token for a Firebase UID.
 * Throws if no session secret is configured (fail closed).
 */
export async function createSessionToken(uid: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET (or ADMIN_SESSION_SECRET) is not configured");
  const mac = await sign(uid, secret);
  return `${toBase64Url(encoder.encode(uid))}.${toBase64Url(mac)}`;
}

/**
 * Verify a session token and return the embedded Firebase UID, or null if the
 * token is missing, malformed, or has an invalid signature. Returns null when
 * the secret is unconfigured (fail closed).
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const uidBytes = fromBase64Url(token.slice(0, dot));
  const providedSig = fromBase64Url(token.slice(dot + 1));
  if (!uidBytes || !providedSig) return null;

  const uid = new TextDecoder().decode(uidBytes);
  const expectedSig = await sign(uid, secret);
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  return uid || null;
}
