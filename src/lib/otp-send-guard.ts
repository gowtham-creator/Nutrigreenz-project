import "server-only";
import { bumpFailure, maxRetryAfter } from "@/lib/admin-login-guard";
import { OTP_RESEND_SECONDS } from "@/lib/otp-provider";

/**
 * Rate limit for OTP *sending*, persisted rather than held in memory.
 *
 * ── Why the in-memory version was not a control ───────────────────────────
 *
 * The limiter this replaces kept its counters in a module-level Map. On Vercel
 * every serverless instance holds its own copy, so the "five sends per fifteen
 * minutes" cap was really five per instance: concurrency multiplied it, and a
 * cold start reset it to zero. Anyone willing to spread requests out defeated
 * it without trying, and nothing recorded that they had.
 *
 * That matters because each send costs money and lands on a real handset. The
 * two abuses are texting one person repeatedly, and using the endpoint as a
 * free SMS cannon aimed at numbers that are not ours.
 *
 * ── Why the phone alone was not enough ────────────────────────────────────
 *
 * The old limiter keyed only on the number, reasoning that a shared NAT should
 * not lock out a legitimate user. True — but it means one client can request a
 * code for a thousand DIFFERENT numbers and never trip anything, which is the
 * expensive attack. Both keys are counted now: the number bounds harassment of
 * one person, the address bounds the spend.
 *
 * Backed by the same `admin_login_attempts` table as the passcode, TOTP and
 * verify guards, under its own prefixes. Fail-OPEN with Supabase unconfigured,
 * inherited from those primitives — there is no store to count in, and refusing
 * every sign-in is worse than not throttling one.
 */

/** Per number: 5 sends an hour, then an hour's cooldown. */
const PHONE_MAX = 5;
const PHONE_LOCK_MS = 60 * 60 * 1000;
const PHONE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Per source address: 20 an hour.
 *
 * Deliberately well above the per-number cap. A family, an office or a shared
 * connection can legitimately produce several sign-ins in an hour, and this
 * must not be the thing that stops them; it is here to bound a script, not a
 * household.
 */
const IP_MAX = 20;
const IP_LOCK_MS = 60 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;

/** Minimum gap between two sends to the same number — the same wait the
 *  sign-in screens show, so a resend the button allows is never refused. */
const COOLDOWN_MS = OTP_RESEND_SECONDS * 1000;
const COOLDOWN_MAX = 1;

const phoneKey = (mobile: string) => `otp-send:${mobile}`;
const burstKey = (mobile: string) => `otp-burst:${mobile}`;
const ipKey = (ip: string) => `otp-send-ip:${ip}`;

export interface SendLimit {
  ok: boolean;
  /** Seconds until the caller may try again (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * Record and evaluate a send attempt.
 *
 * Counts BEFORE the SMS goes out, unlike the failure counters elsewhere: a
 * message that has been paid for and delivered has already cost what it costs,
 * so there is nothing to learn from its outcome.
 */
export async function checkOtpSendAllowed(
  mobile: string,
  ip: string | null,
): Promise<SendLimit> {
  const keys = [phoneKey(mobile), burstKey(mobile)];
  if (ip) keys.push(ipKey(ip));

  const retryAfterSeconds = await maxRetryAfter(keys);
  if (retryAfterSeconds > 0) return { ok: false, retryAfterSeconds };

  /*
   * The burst key is a one-shot counter with a thirty-second lock: a single
   * send fills it, so the next attempt inside the window is refused and the
   * one after the lock expires starts clean. It stops a looping client firing
   * a message a second while the hourly cap still has headroom.
   */
  await bumpFailure(burstKey(mobile), COOLDOWN_MAX, COOLDOWN_MS, COOLDOWN_MS);
  await bumpFailure(phoneKey(mobile), PHONE_MAX, PHONE_LOCK_MS, PHONE_WINDOW_MS);
  if (ip) await bumpFailure(ipKey(ip), IP_MAX, IP_LOCK_MS, IP_WINDOW_MS);

  return { ok: true, retryAfterSeconds: 0 };
}

/** Client address, matching how the reset and verify paths read it. */
export function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
