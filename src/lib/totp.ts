/**
 * TOTP (RFC 6238) verification — dependency-free, Web Crypto only.
 *
 * Gates super-admin sign-in behind an authenticator app (Google Authenticator,
 * Authy, 1Password, …). Standard parameters: HMAC-SHA1, 6 digits, 30-second
 * period, ±1 step tolerance for clock drift. The shared secret is a base32
 * string supplied via the `ADMIN_TOTP_SECRET` environment variable.
 *
 * Like admin-session.ts, this avoids `node:crypto` and uses only
 * `crypto.subtle`, so it runs in any runtime.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;

/** True when a non-trivial authenticator secret is configured. */
export function isTotpConfigured(): boolean {
  const s = process.env.ADMIN_TOTP_SECRET;
  return typeof s === "string" && s.replace(/\s/g, "").length >= 16;
}

/** Decode a base32 (RFC 4648) string to bytes. Returns null on invalid input. */
function base32Decode(input: string): Uint8Array<ArrayBuffer> | null {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  if (!clean) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Encode a counter as an 8-byte big-endian buffer (overflow-safe). */
function counterBytes(counter: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return buf;
}

/** RFC 4226 HOTP: HMAC-SHA1 + dynamic truncation → DIGITS-length string. */
async function hotp(
  keyBytes: Uint8Array<ArrayBuffer>,
  counter: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counterBytes(counter)),
  );
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Length-safe constant-time string compare. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Generate the current TOTP code for a base32 secret. Exposed for QR-secret
 * self-checks and tests; not used on the live verify path. Returns null when
 * the secret can't be decoded.
 */
export async function generateTotp(
  secretBase32: string,
  forUnixSeconds?: number,
): Promise<string | null> {
  const key = base32Decode(secretBase32);
  if (!key) return null;
  const t = Math.floor((forUnixSeconds ?? Date.now() / 1000) / PERIOD_SECONDS);
  return hotp(key, t);
}

/**
 * Verify a user-entered 6-digit code against the base32 secret, tolerating
 * ±`window` 30-second steps of clock drift (default ±1 → previous, current and
 * next codes). Returns false on any malformed input.
 */
export async function verifyTotp(
  code: string,
  secretBase32: string,
  window = 1,
): Promise<boolean> {
  const digits = (code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return false;
  const key = base32Decode(secretBase32);
  if (!key) return false;
  const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
  for (let w = -window; w <= window; w++) {
    const candidate = await hotp(key, step + w);
    if (timingSafeEqualStr(candidate, digits)) return true;
  }
  return false;
}

/** Generate a fresh base32 (RFC 4648, no padding) TOTP secret (~20 bytes → 32 chars). */
export function generateTotpSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

/** The `otpauth://` URI a QR encodes for Google / Microsoft Authenticator. */
export function buildOtpauthUri(
  email: string,
  secretBase32: string,
  issuer = "Nutri Greenz",
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
