/**
 * Admin password-reset tokens — signed, expiring, and single-use.
 *
 * A reset link carries a token of the form
 *   `${base64url(payload)}.${base64url(HMAC_SHA256(payload, secret))}`
 * where payload = `${email}|reset|${expiresAtMs}|${jti}`. The literal `reset`
 * tag (never a real role) sits between the email and the rest, so this token can
 * never be mistaken for an `ng_admin` session or an MFA ticket, and vice-versa.
 *
 * Single-use is enforced by a backing row in `public.admin_password_resets`
 * keyed on `jti`: {@link consumeAdminResetToken} atomically stamps `used_at`
 * (only an unused, unexpired row is consumable), so a link works exactly once.
 *
 * Signed with `ADMIN_SESSION_SECRET` via the Web Crypto API only (no
 * `node:crypto`), and fails closed — returns null — when the secret or Supabase
 * is unconfigured, so no reset can be minted or accepted without both.
 *
 * Service-role only — import from Node route handlers, never client/Edge.
 */
import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";

/** Reset links expire 30 minutes after they are issued. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

async function sign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const normEmail = (email: string) => email.trim().toLowerCase();

/**
 * Mint a signed, single-use reset token for `email` and persist its backing row.
 * Returns the token, or null when the secret/Supabase is unconfigured or the row
 * could not be written (fail closed). The caller decides whether to email it.
 */
export async function createAdminResetToken(
  email: string,
  ttlMs: number = RESET_TOKEN_TTL_MS,
): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !isSupabaseConfigured) return null;

  const account = normEmail(email);
  if (!account) return null;

  const jti = toBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const expiresAt = Date.now() + Math.max(60_000, ttlMs);

  const { error } = await supabaseAdmin().from("admin_password_resets").insert({
    email: account,
    jti,
    expires_at: new Date(expiresAt).toISOString(),
  });
  if (error) return null;

  const claims = `${account}|reset|${expiresAt}|${jti}`;
  const mac = await sign(claims, secret);
  return `${toBase64Url(encoder.encode(claims))}.${toBase64Url(mac)}`;
}

/**
 * Verify a reset token (signature + expiry) and CONSUME it (single-use). Returns
 * the bound admin email on success, or null if the token is missing, malformed,
 * badly signed, mis-tagged, expired, already used, or unknown. Fails closed when
 * the secret/Supabase is unconfigured.
 */
export async function consumeAdminResetToken(token: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !isSupabaseConfigured || !token) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const claimsBytes = fromBase64Url(token.slice(0, dot));
  const providedSig = fromBase64Url(token.slice(dot + 1));
  if (!claimsBytes || !providedSig) return null;

  const claims = new TextDecoder().decode(claimsBytes);
  const expectedSig = await sign(claims, secret);
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  // Parse `${email}|reset|${expiresAt}|${jti}` from the right (emails may
  // contain "|"), so the three trailing segments stay unambiguous.
  const sepJti = claims.lastIndexOf("|");
  if (sepJti <= 0) return null;
  const jti = claims.slice(sepJti + 1);
  const beforeJti = claims.slice(0, sepJti);
  const sepExp = beforeJti.lastIndexOf("|");
  if (sepExp <= 0) return null;
  const expiresAt = Number(beforeJti.slice(sepExp + 1));
  const beforeExp = beforeJti.slice(0, sepExp);
  const sepTag = beforeExp.lastIndexOf("|");
  if (sepTag <= 0) return null;
  const tag = beforeExp.slice(sepTag + 1);
  const email = beforeExp.slice(0, sepTag);

  if (tag !== "reset" || !email || !jti) return null;
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  // Atomic single-use: only an unused, unexpired row for this jti is consumable.
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin()
    .from("admin_password_resets")
    .update({ used_at: nowIso })
    .eq("jti", jti)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("email")
    .maybeSingle();
  if (!data) return null;

  const rowEmail = String((data as { email: string }).email).toLowerCase();
  // The signed email and the stored email must agree.
  if (rowEmail !== email.toLowerCase()) return null;
  return rowEmail;
}
