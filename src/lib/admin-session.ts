/**
 * Admin session token — Edge-compatible HMAC signing/verification.
 *
 * This module is intentionally dependency-free and uses only the Web Crypto
 * API (`crypto.subtle`), which is available in both the Edge runtime (where
 * `proxy.ts` runs) and the Node.js runtime (where the route handlers run).
 *
 * It must NOT import `next/headers` or `node:crypto` so it can be imported
 * cleanly into the Edge proxy. Cookie reading/writing is handled by callers.
 *
 * Token format: `${base64url(email)}.${base64url(HMAC_SHA256(email, secret))}`
 *
 * The signing secret comes from `process.env.ADMIN_SESSION_SECRET`. The module
 * fails closed: if the secret is unset, `createToken` throws and `verifyToken`
 * returns null, so no session can ever be minted or accepted without a secret.
 */

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/** Encode bytes as URL-safe base64 (no padding). */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
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

/** Import the secret as an HMAC-SHA256 signing key. */
async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Compute HMAC-SHA256(email, secret) as raw bytes. */
async function sign(email: string, secret: string): Promise<Uint8Array> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(email));
  return new Uint8Array(sig);
}

/** Length-safe constant-time comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Mint a signed session token for the given email.
 * Throws if `ADMIN_SESSION_SECRET` is not configured (fail closed).
 */
export async function createToken(email: string): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  const mac = await sign(email, secret);
  const payload = toBase64Url(encoder.encode(email));
  const signature = toBase64Url(mac);
  return `${payload}.${signature}`;
}

/**
 * Verify a session token and return the embedded email, or null if the token
 * is missing, malformed, or has an invalid signature. Returns null when the
 * secret is unconfigured (fail closed).
 */
export async function verifyToken(
  token: string | undefined,
): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const payloadPart = token.slice(0, dot);
  const signaturePart = token.slice(dot + 1);

  const emailBytes = fromBase64Url(payloadPart);
  const providedSig = fromBase64Url(signaturePart);
  if (!emailBytes || !providedSig) return null;

  const email = new TextDecoder().decode(emailBytes);
  const expectedSig = await sign(email, secret);

  if (!timingSafeEqual(providedSig, expectedSig)) return null;
  return email;
}
