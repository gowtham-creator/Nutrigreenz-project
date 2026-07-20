/**
 * Brute-force throttling for admin sign-in — persisted failed-attempt counters
 * with lockout windows (Supabase `public.admin_login_attempts`).
 *
 * Two surfaces share the same table via distinct key prefixes:
 *   - passcode login: `email:<addr>` and `ip:<addr>` (5 fails → 15-min lock),
 *   - TOTP second factor: `totp:<addr>` (5 fails → 5-min lock).
 *
 * Fail-OPEN when Supabase is unconfigured (there is no store to persist counters,
 * and we must not lock every operator out of the demo). Service-role only —
 * import from Node route handlers, never client/Edge.
 */
import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const TOTP_MAX_FAILURES = 5;
const TOTP_LOCK_MS = 5 * 60 * 1000;
const TOTP_WINDOW_MS = 5 * 60 * 1000;

const norm = (v: string) => v.trim().toLowerCase();

interface AttemptRow {
  id: string;
  fail_count: number;
  last_failed_at: string | null;
  locked_until: string | null;
}

/** Max remaining lock (seconds) across the given keys; 0 when none are locked. */
async function maxRetryAfter(keys: string[]): Promise<number> {
  if (!isSupabaseConfigured || keys.length === 0) return 0;
  const { data } = await supabaseAdmin()
    .from("admin_login_attempts")
    .select("locked_until")
    .in("attempt_key", keys);
  const now = Date.now();
  let retryAfter = 0;
  for (const row of (data as { locked_until: string | null }[] | null) ?? []) {
    if (!row.locked_until) continue;
    const ms = new Date(row.locked_until).getTime() - now;
    if (ms > 0) retryAfter = Math.max(retryAfter, Math.ceil(ms / 1000));
  }
  return retryAfter;
}

/** Increment the failure counter for a key, arming a lock once the cap is hit. */
async function bumpFailure(
  key: string,
  maxFailures: number,
  lockMs: number,
  windowMs: number,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const db = supabaseAdmin();
  const now = Date.now();
  const { data } = await db
    .from("admin_login_attempts")
    .select("id, fail_count, last_failed_at, locked_until")
    .eq("attempt_key", key)
    .maybeSingle();
  const row = data as AttemptRow | null;

  if (!row) {
    await db.from("admin_login_attempts").insert({
      attempt_key: key,
      fail_count: 1,
      last_failed_at: new Date(now).toISOString(),
    });
    return;
  }

  // Reset a stale counter (last failure older than the window) back to 1.
  const last = row.last_failed_at ? new Date(row.last_failed_at).getTime() : 0;
  const nextCount = now - last > windowMs ? 1 : row.fail_count + 1;
  const patch: Record<string, unknown> = {
    fail_count: nextCount,
    last_failed_at: new Date(now).toISOString(),
  };
  if (nextCount >= maxFailures) patch.locked_until = new Date(now + lockMs).toISOString();
  await db.from("admin_login_attempts").update(patch).eq("id", row.id);
}

/** Clear counters for the given keys (called on a successful factor). */
async function clearKeys(keys: string[]): Promise<void> {
  if (!isSupabaseConfigured || keys.length === 0) return;
  await supabaseAdmin().from("admin_login_attempts").delete().in("attempt_key", keys);
}

function loginKeys(email: string, ip: string | null): string[] {
  const keys = [`email:${norm(email)}`];
  if (ip) keys.push(`ip:${ip}`);
  return keys;
}

export interface LoginThrottle {
  allowed: boolean;
  retryAfterSec: number;
}

/** Whether a passcode login for this email/IP is currently allowed. */
export async function checkLoginAllowed(email: string, ip: string | null): Promise<LoginThrottle> {
  const retryAfterSec = await maxRetryAfter(loginKeys(email, ip));
  return { allowed: retryAfterSec === 0, retryAfterSec };
}

/** Record a failed passcode attempt against both the email and the IP. */
export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  for (const key of loginKeys(email, ip)) {
    await bumpFailure(key, LOGIN_MAX_FAILURES, LOGIN_LOCK_MS, LOGIN_WINDOW_MS);
  }
}

/** Clear passcode counters after a valid credential (even if MFA is still pending). */
export async function recordLoginSuccess(email: string, ip: string | null): Promise<void> {
  await clearKeys(loginKeys(email, ip));
}

/** Whether TOTP verification for this admin is currently allowed. */
export async function checkTotpAllowed(email: string): Promise<LoginThrottle> {
  const retryAfterSec = await maxRetryAfter([`totp:${norm(email)}`]);
  return { allowed: retryAfterSec === 0, retryAfterSec };
}

/** Record a failed TOTP attempt (fails closed after the cap for a cooldown). */
export async function recordTotpFailure(email: string): Promise<void> {
  await bumpFailure(`totp:${norm(email)}`, TOTP_MAX_FAILURES, TOTP_LOCK_MS, TOTP_WINDOW_MS);
}

/** Clear the TOTP failure counter after a successful verification. */
export async function clearTotpFailures(email: string): Promise<void> {
  await clearKeys([`totp:${norm(email)}`]);
}
