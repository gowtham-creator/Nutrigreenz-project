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
 * The token now encodes BOTH the operator email AND their role. The signed
 * payload is the string `${email}|${role}`, so the role is tamper-proof (it is
 * covered by the HMAC alongside the email).
 *
 * Token format: `${base64url(`${email}|${role}`)}.${base64url(HMAC_SHA256(`${email}|${role}`, secret))}`
 *
 * The signing secret comes from `process.env.ADMIN_SESSION_SECRET`. The module
 * fails closed: if the secret is unset, `createToken` throws and `verifyToken`
 * returns null, so no session can ever be minted or accepted without a secret.
 */

/** Roles an admin session can hold. */
export type AdminRole = "admin" | "superadmin";

/** Decoded, verified session payload. */
export interface AdminSession {
  email: string;
  role: AdminRole;
}

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

/** Compute HMAC-SHA256(payload, secret) as raw bytes. */
async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return new Uint8Array(sig);
}

/** Validate that an arbitrary string is a known role. */
function isAdminRole(value: string): value is AdminRole {
  return value === "admin" || value === "superadmin";
}

/** Length-safe constant-time comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Mint a signed session token binding the given email AND role.
 * The signed payload is `${email}|${role}`, so the role cannot be tampered
 * with without invalidating the signature.
 * Throws if `ADMIN_SESSION_SECRET` is not configured (fail closed).
 */
export async function createToken(
  email: string,
  role: AdminRole,
): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  const claims = `${email}|${role}`;
  const mac = await sign(claims, secret);
  const payload = toBase64Url(encoder.encode(claims));
  const signature = toBase64Url(mac);
  return `${payload}.${signature}`;
}

/**
 * Verify a session token and return the embedded `{ email, role }`, or null if
 * the token is missing, malformed, carries an unknown role, or has an invalid
 * signature. Returns null when the secret is unconfigured (fail closed).
 */
export async function verifyToken(
  token: string | undefined,
): Promise<AdminSession | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const payloadPart = token.slice(0, dot);
  const signaturePart = token.slice(dot + 1);

  const claimsBytes = fromBase64Url(payloadPart);
  const providedSig = fromBase64Url(signaturePart);
  if (!claimsBytes || !providedSig) return null;

  const claims = new TextDecoder().decode(claimsBytes);
  const expectedSig = await sign(claims, secret);

  // Verify the signature over the raw claims BEFORE trusting any field.
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  // Split `${email}|${role}` from the right so emails containing "|" are safe.
  const sep = claims.lastIndexOf("|");
  if (sep <= 0 || sep === claims.length - 1) return null;
  const email = claims.slice(0, sep);
  const role = claims.slice(sep + 1);
  if (!email || !isAdminRole(role)) return null;

  return { email, role };
}
