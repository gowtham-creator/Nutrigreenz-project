/**
 * Captain session token — Edge-compatible HMAC signing/verification.
 *
 * Mirrors `@/lib/admin-session`: the crypto core uses ONLY the Web Crypto API
 * (`crypto.subtle`), available in both the Edge runtime (where `proxy.ts` runs)
 * and Node (route handlers). The module has NO STATIC `next/headers` /
 * `node:crypto` import, so it can be imported cleanly into the Edge proxy for
 * verification. The Node-only cookie helpers (`mintCaptainSession`,
 * `clearCaptainSession`, `requireCaptain`) reach `cookies()` through a DYNAMIC
 * `import("next/headers")`, which keeps `next/headers` out of the proxy's Edge
 * bundle while still letting the route handlers set/clear the cookie.
 *
 * The signed payload is the string `${captainId}|${phone}|${expiresAtMs}` (a
 * captain id is a uuid and a phone is 10 digits — neither contains "|"), so all
 * three are covered by the HMAC and cannot be tampered with. The expiry lives
 * INSIDE the token: the cookie's maxAge only tells the browser when to forget
 * it, so without a signed expiry a copied token would be valid forever. Legacy
 * two-part tokens (no expiry) are rejected, which signs those captains out once.
 *
 * Token format: `${base64url(`${captainId}|${phone}|${exp}`)}.${base64url(HMAC_SHA256(...))}`.
 *
 * The signing secret is `CAPTAIN_SESSION_SECRET`, falling back to
 * `ADMIN_SESSION_SECRET` so a single-secret deployment still works. It FAILS
 * CLOSED: with no secret, `mintCaptainSession` throws and verification returns
 * null, so no captain session is ever minted or accepted.
 */

/** httpOnly signed session cookie — the real gate. Read server-side only. */
export const CAPTAIN_COOKIE = "ng_captain";

/**
 * Captain session idle window, in seconds. Matches the admin session TTL so the
 * two portals age out identically (the cookie is re-set at login).
 */
export const CAPTAIN_SESSION_TTL_SECONDS = 30 * 60;

/** Decoded, verified captain session. */
export interface CaptainSessionPayload {
  captainId: string;
  phone: string;
}

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret =
    process.env.CAPTAIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
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

/** Length-safe constant-time comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Mint a signed captain session token binding `captainId` + `phone`. Throws
 *  when no secret is configured (fail closed). Pure — sets no cookie. */
export async function createCaptainToken(captainId: string, phone: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("CAPTAIN_SESSION_SECRET (or ADMIN_SESSION_SECRET) is not configured");
  const expiresAt = Date.now() + CAPTAIN_SESSION_TTL_SECONDS * 1000;
  const claims = `${captainId}|${phone}|${expiresAt}`;
  const mac = await sign(claims, secret);
  return `${toBase64Url(encoder.encode(claims))}.${toBase64Url(mac)}`;
}

/** Verify a captain session token and return `{ captainId, phone }`, or null if
 *  missing/malformed/badly signed. Returns null when unconfigured (fail closed). */
export async function verifyCaptainSession(
  token: string | undefined,
): Promise<CaptainSessionPayload | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const claimsBytes = fromBase64Url(token.slice(0, dot));
  const providedSig = fromBase64Url(token.slice(dot + 1));
  if (!claimsBytes || !providedSig) return null;

  const claims = new TextDecoder().decode(claimsBytes);
  const expectedSig = await sign(claims, secret);
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  const parts = claims.split("|");
  if (parts.length !== 3) return null;
  const [captainId, phone, exp] = parts;
  const expiresAt = Number(exp);
  if (!captainId || !phone) return null;
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return { captainId, phone };
}

/* ── cookie readers ───────────────────────────────────────────────────────── */

interface CookieAccessor {
  get(name: string): { value: string } | undefined;
}
interface RequestLike {
  cookies: CookieAccessor;
}

function hasRequestCookies(source: unknown): source is RequestLike {
  return (
    typeof source === "object" &&
    source !== null &&
    "cookies" in source &&
    typeof (source as RequestLike).cookies?.get === "function"
  );
}

function isCookieAccessor(source: unknown): source is CookieAccessor {
  return (
    typeof source === "object" &&
    source !== null &&
    typeof (source as CookieAccessor).get === "function"
  );
}

/**
 * Verify the captain session from a request or cookie store. Edge-safe — accepts
 * a `NextRequest` (via `.cookies.get`, used by the proxy) or a `next/headers`
 * cookie store (via `.get`). Returns the payload, or null.
 */
export async function readCaptainSession(
  source: RequestLike | CookieAccessor,
): Promise<CaptainSessionPayload | null> {
  let token: string | undefined;
  if (hasRequestCookies(source)) token = source.cookies.get(CAPTAIN_COOKIE)?.value;
  else if (isCookieAccessor(source)) token = source.get(CAPTAIN_COOKIE)?.value;
  return verifyCaptainSession(token);
}

/* ── Node-only cookie writers + route guard (dynamic next/headers) ──────────── */

/**
 * Establish the captain session: mint a signed token and write the httpOnly
 * `ng_captain` cookie with the SAME flags as the admin session (secure in prod,
 * `sameSite: lax`, path `/`, matching maxAge). Node route handlers only.
 */
export async function mintCaptainSession(captainId: string, phone: string): Promise<void> {
  const token = await createCaptainToken(captainId, phone);
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set({
    name: CAPTAIN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CAPTAIN_SESSION_TTL_SECONDS,
  });
}

/** Sign the captain out: expire the httpOnly session cookie. Node only. */
export async function clearCaptainSession(): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set({
    name: CAPTAIN_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Gate a captain API route on a valid session. Returns the verified
 * `{ captainId, phone }` when signed in, or a 401 `Response` to short-circuit
 * with. Node route handlers only.
 *
 *   const gate = await requireCaptain();
 *   if (gate instanceof Response) return gate;
 *   const { captainId } = gate;
 */
export async function requireCaptain(): Promise<CaptainSessionPayload | Response> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const payload = await verifyCaptainSession(store.get(CAPTAIN_COOKIE)?.value);
  if (!payload) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  // Slide the idle window: a captain working a stall all day stays signed in
  // while they keep using the tool, and is signed out after TTL of no activity.
  await mintCaptainSession(payload.captainId, payload.phone);
  return payload;
}
