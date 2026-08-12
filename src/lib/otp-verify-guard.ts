/**
 * Brute-force throttling for storefront OTP sign-in.
 *
 * ── Why this has to exist ─────────────────────────────────────────────────
 *
 * `/api/auth/otp/verify` trades a six-digit code for a thirty-day session
 * cookie. Until this existed there was no attempt counter anywhere on that
 * path: `proxy.ts` excludes `/api` from its matcher, the send-side limiter in
 * the send-side guard only caps how many codes go OUT, and MSG91's own
 * throttle is undocumented and not ours to rely on. So the only thing between a
 * known mobile number and somebody else's order history, saved addresses and
 * personal details was guessing six digits, unlimited times, with nothing
 * recorded and nobody told.
 *
 * The admin portal already solved exactly this problem for its passcode and its
 * authenticator (see `@/lib/admin-login-guard`). This is the same control,
 * pointed at the customer path, sharing that module's counters and the
 * `public.admin_login_attempts` table under its own key prefixes.
 *
 * ── The limits, and why these numbers ─────────────────────────────────────
 *
 * Five failures per number in fifteen minutes, then a fifteen-minute lock. That
 * caps a single number at roughly twenty guesses an hour against a million
 * codes, which is not an attack anyone finishes — while still leaving a real
 * person who fat-fingers the keypad three times room to get it right.
 *
 * The IP counter is the one that catches the actual attack. Spraying one guess
 * each across a thousand numbers never trips any single number's counter, but
 * every one of those failures lands on the same source address. Twenty an hour,
 * then locked for an hour.
 *
 * Fail-OPEN when Supabase is unconfigured — inherited from the primitives,
 * deliberate, and the same choice the admin guard makes: there is no store to
 * count in, and refusing every sign-in is worse than not throttling one.
 *
 * Service-role only — import from Node route handlers, never client/Edge.
 */
import "server-only";
import { bumpFailure, clearKeys, maxRetryAfter } from "@/lib/admin-login-guard";

/** Per-number: 5 failures in 15 minutes, then locked for 15. */
const PHONE_MAX_FAILURES = 5;
const PHONE_LOCK_MS = 15 * 60 * 1000;
const PHONE_WINDOW_MS = 15 * 60 * 1000;

/** Per-source-IP: 20 failures in an hour, then locked for an hour. */
const IP_MAX_FAILURES = 20;
const IP_LOCK_MS = 60 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;

/*
 * Distinct prefixes keep these counters from colliding with the admin ones in
 * the shared table. A customer locking themselves out of the storefront must
 * never contribute to an operator's portal lockout, or vice-versa.
 */
const phoneKey = (mobile: string) => `otp:${mobile}`;
const ipKey = (ip: string) => `otp-ip:${ip}`;

export interface OtpVerifyThrottle {
  allowed: boolean;
  /** Seconds until the caller may try again (0 when allowed). */
  retryAfterSec: number;
}

/** Whether an OTP verification for this number/IP is currently allowed. */
export async function checkOtpVerifyAllowed(
  mobile: string,
  ip: string | null,
): Promise<OtpVerifyThrottle> {
  const keys = [phoneKey(mobile)];
  if (ip) keys.push(ipKey(ip));
  const retryAfterSec = await maxRetryAfter(keys);
  return { allowed: retryAfterSec === 0, retryAfterSec };
}

/** Record a wrong code against both the number and the source address. */
export async function recordOtpVerifyFailure(
  mobile: string,
  ip: string | null,
): Promise<void> {
  await bumpFailure(phoneKey(mobile), PHONE_MAX_FAILURES, PHONE_LOCK_MS, PHONE_WINDOW_MS);
  if (ip) {
    await bumpFailure(ipKey(ip), IP_MAX_FAILURES, IP_LOCK_MS, IP_WINDOW_MS);
  }
}

/**
 * Clear the number's counter after a correct code.
 *
 * The IP counter is deliberately NOT cleared. An attacker working through a
 * list will land a valid sign-in eventually — their own number, or a lucky
 * guess — and letting that wipe the address-level counter would hand them a
 * free reset of the only limit that was actually tracking them.
 */
export async function clearOtpVerifyFailures(mobile: string): Promise<void> {
  await clearKeys([phoneKey(mobile)]);
}
