import "server-only";

/**
 * Best-effort in-memory OTP-send rate limiter (anti-abuse).
 *
 * Caps how many SMS codes a single key (a normalised phone) may request within
 * a rolling window. In a serverless deployment this is PER-INSTANCE, so it is a
 * first line of defence layered on top of MSG91's own throttling — not a global
 * guarantee. No external store or table is required. Keyed by phone rather than
 * IP so a shared NAT can't lock a legitimate user out, and so one abusive client
 * can't burn another number's budget.
 */

/** Rolling window length. */
const WINDOW_MS = 15 * 60 * 1000;
/** Max sends allowed per key within the window. */
const MAX_SENDS = 5;
/** Minimum gap between two sends to the same key (resend cooldown). */
const COOLDOWN_MS = 30 * 1000;

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may try again (0 when allowed). */
  retryAfterSeconds: number;
}

/** Record and evaluate a send attempt for `key`. */
export function checkOtpSendLimit(key: string): RateLimitResult {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_SENDS) {
    buckets.set(key, recent);
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  // Resend cooldown: block a burst of back-to-back sends to the same number even
  // when the per-window cap has headroom, so a leaked/looping client can't fire
  // an SMS every second.
  const last = recent[recent.length - 1];
  if (last !== undefined && now - last < COOLDOWN_MS) {
    buckets.set(key, recent);
    const retryAfterSeconds = Math.max(1, Math.ceil((COOLDOWN_MS - (now - last)) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  recent.push(now);
  buckets.set(key, recent);

  // Opportunistic cleanup so the map can't grow unbounded across many numbers.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }

  return { ok: true, retryAfterSeconds: 0 };
}
