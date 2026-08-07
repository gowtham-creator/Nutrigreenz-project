/**
 * Brute-force throttling for admin sign-in — persisted failed-attempt counters
 * with lockout windows (Supabase `public.admin_login_attempts`).
 *
 * Two surfaces share the same table via distinct key prefixes:
 *   - passcode login: `email:<addr>` and `ip:<addr>`,
 *   - TOTP second factor: `totp:<addr>`.
 *
 * Both allow 10 failures inside an hour, then lock for 3 hours and email the
 * super admins. A lock nobody is told about only buys time; the notification is
 * what turns it into something anyone can act on.
 *
 * Fail-OPEN when Supabase is unconfigured (there is no store to persist counters,
 * and we must not lock every operator out of the demo). Service-role only —
 * import from Node route handlers, never client/Edge.
 */
import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { alertAccountLocked, type LockScope } from "@/lib/admin-security-alerts";

const MAX_FAILURES = 10;
const LOCK_MS = 3 * 60 * 60 * 1000;
/*
 * The counting window is an hour while the lock is three.
 *
 * Deliberately shorter than the lock: an operator who mistypes twice on Monday
 * and three times on Friday should not accumulate toward a lockout, so the
 * counter forgets old failures. It must not be so short that an attacker can
 * pace attempts underneath it — ten tries an hour against a passcode is far too
 * slow to be worth anyone's time.
 */
const WINDOW_MS = 60 * 60 * 1000;

const LOGIN_MAX_FAILURES = MAX_FAILURES;
const LOGIN_LOCK_MS = LOCK_MS;
const LOGIN_WINDOW_MS = WINDOW_MS;

const TOTP_MAX_FAILURES = MAX_FAILURES;
const TOTP_LOCK_MS = LOCK_MS;
const TOTP_WINDOW_MS = WINDOW_MS;

/** Minutes, for the alert email. */
const LOCK_MINUTES = Math.round(LOCK_MS / 60_000);

const norm = (v: string) => v.trim().toLowerCase();

interface AttemptRow {
  id: string;
  fail_count: number;
  last_failed_at: string | null;
  locked_until: string | null;
}

/*
 * The three primitives below are generic — they only ever see an opaque
 * `attempt_key` — so they are exported and reused by the storefront OTP guard
 * (`@/lib/otp-verify-guard`), which throttles customer sign-in against the same
 * table under its own `otp:` / `otp-ip:` prefixes. Sharing them rather than
 * copying sixty lines means a fix to the counting or lock arithmetic lands on
 * every surface at once, which is the only way this stays correct.
 */

/** Max remaining lock (seconds) across the given keys; 0 when none are locked. */
export async function maxRetryAfter(keys: string[]): Promise<number> {
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

/**
 * Increment the failure counter for a key, arming a lock once the cap is hit.
 *
 * @returns `justLocked` true ONLY on the attempt that armed the lock, so a
 *   caller can notify exactly once. Every further attempt against an
 *   already-locked account returns false — otherwise a script hammering a
 *   locked account would mail the super admins on every single request, which
 *   is its own denial of service.
 */
export async function bumpFailure(
  key: string,
  maxFailures: number,
  lockMs: number,
  windowMs: number,
): Promise<{ justLocked: boolean; failures: number }> {
  if (!isSupabaseConfigured) return { justLocked: false, failures: 0 };
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
    return { justLocked: false, failures: 1 };
  }

  const alreadyLocked = row.locked_until
    ? new Date(row.locked_until).getTime() > now
    : false;

  // Reset a stale counter (last failure older than the window) back to 1.
  const last = row.last_failed_at ? new Date(row.last_failed_at).getTime() : 0;
  const nextCount = now - last > windowMs ? 1 : row.fail_count + 1;
  const patch: Record<string, unknown> = {
    fail_count: nextCount,
    last_failed_at: new Date(now).toISOString(),
  };

  const hitCap = nextCount >= maxFailures;
  if (hitCap) patch.locked_until = new Date(now + lockMs).toISOString();
  await db.from("admin_login_attempts").update(patch).eq("id", row.id);

  return { justLocked: hitCap && !alreadyLocked, failures: nextCount };
}

/** Clear counters for the given keys (called on a successful factor). */
export async function clearKeys(keys: string[]): Promise<void> {
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

/**
 * Record a failed passcode attempt against both the email and the IP.
 *
 * Counting the IP separately matters: an attacker spraying one password across
 * many admin addresses never trips any single account's counter, but does trip
 * the address they are coming from.
 */
export async function recordLoginFailure(
  email: string,
  ip: string | null,
  userAgent?: string | null,
): Promise<void> {
  let locked = false;
  let failures = 0;

  for (const key of loginKeys(email, ip)) {
    const outcome = await bumpFailure(key, LOGIN_MAX_FAILURES, LOGIN_LOCK_MS, LOGIN_WINDOW_MS);
    // Either key arming a lock is worth telling somebody about.
    if (outcome.justLocked) locked = true;
    failures = Math.max(failures, outcome.failures);
  }

  if (locked) {
    await notifyLock({ email, scope: "password", failures, ip, userAgent });
  }
}

/** Send the lockout alert. Isolated so a mail failure cannot fail a login. */
async function notifyLock(input: {
  email: string;
  scope: LockScope;
  failures: number;
  ip: string | null;
  userAgent?: string | null;
}): Promise<void> {
  console.warn(
    `[admin-login-guard] locked ${input.scope} for ${LOCK_MINUTES}m after ${input.failures} failures`,
  );
  await alertAccountLocked({
    email: input.email,
    scope: input.scope,
    failures: input.failures,
    lockedForMinutes: LOCK_MINUTES,
    ip: input.ip,
    userAgent: input.userAgent ?? null,
  });
}

/** Clear passcode counters after a valid credential (even if MFA is still pending). */
export async function recordLoginSuccess(email: string, ip: string | null): Promise<void> {
  await clearKeys(loginKeys(email, ip));
}

/* ── password-reset requests ──────────────────────────────────────────── */

/**
 * Reset requests are throttled far harder than sign-ins: three an hour.
 *
 * Nobody legitimately needs a fourth reset link within the hour, and each
 * request sends mail to a real operator's inbox. Without a cap, the endpoint is
 * a free email cannon pointed at whichever admin address an attacker knows.
 */
const RESET_MAX = 3;
const RESET_LOCK_MS = 60 * 60 * 1000;
const RESET_WINDOW_MS = 60 * 60 * 1000;

/**
 * Whether a reset request is allowed, split by scope.
 *
 * The two answers are deliberately used differently, and mixing them would
 * reintroduce the user-enumeration this endpoint is careful to avoid:
 *
 *   `ipAllowed`    — safe to answer 429 with. It says nothing about whether any
 *                    given account exists.
 *   `emailAllowed` — must be handled SILENTLY. Refusing loudly for a
 *                    rate-limited address and accepting for an unknown one
 *                    turns the throttle itself into an oracle for which
 *                    addresses are real.
 */
export async function checkResetAllowed(
  email: string,
  ip: string | null,
): Promise<{ ipAllowed: boolean; emailAllowed: boolean; retryAfterSec: number }> {
  const [ipWait, emailWait] = await Promise.all([
    ip ? maxRetryAfter([`reset-ip:${ip}`]) : Promise.resolve(0),
    maxRetryAfter([`reset:${norm(email)}`]),
  ]);
  return {
    ipAllowed: ipWait === 0,
    emailAllowed: emailWait === 0,
    retryAfterSec: Math.max(ipWait, emailWait),
  };
}

/** Count a reset request against both the address and the source IP. */
export async function recordResetRequest(email: string, ip: string | null): Promise<void> {
  const keys = [`reset:${norm(email)}`];
  if (ip) keys.push(`reset-ip:${ip}`);
  for (const key of keys) {
    await bumpFailure(key, RESET_MAX, RESET_LOCK_MS, RESET_WINDOW_MS);
  }
}

/** Whether TOTP verification for this admin is currently allowed. */
export async function checkTotpAllowed(email: string): Promise<LoginThrottle> {
  const retryAfterSec = await maxRetryAfter([`totp:${norm(email)}`]);
  return { allowed: retryAfterSec === 0, retryAfterSec };
}

/**
 * Record a failed TOTP attempt (fails closed after the cap for a cooldown).
 *
 * Worth alerting on more than a passcode failure, not less: reaching the second
 * factor at all means the attacker already has a working passcode.
 */
export async function recordTotpFailure(
  email: string,
  ip: string | null = null,
  userAgent?: string | null,
): Promise<void> {
  const outcome = await bumpFailure(
    `totp:${norm(email)}`,
    TOTP_MAX_FAILURES,
    TOTP_LOCK_MS,
    TOTP_WINDOW_MS,
  );
  if (outcome.justLocked) {
    await notifyLock({
      email,
      scope: "authenticator",
      failures: outcome.failures,
      ip,
      userAgent,
    });
  }
}

/** Clear the TOTP failure counter after a successful verification. */
export async function clearTotpFailures(email: string): Promise<void> {
  await clearKeys([`totp:${norm(email)}`]);
}
