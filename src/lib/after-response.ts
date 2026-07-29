import "server-only";
import { waitUntil } from "@vercel/functions";

/**
 * Run background work that must survive the response being sent.
 *
 * On serverless the function instance is frozen (or torn down) as soon as the
 * route returns, so a bare `void somePromise()` is silently killed mid-flight.
 * That is exactly how the order confirmation and status notifications were being
 * lost: the fetch to the email/SMS provider never got to finish, and because the
 * senders swallow their own errors, nothing surfaced anywhere.
 *
 * `waitUntil` registers the promise with the platform so the instance is kept
 * alive until it settles, WITHOUT delaying the response. Outside Vercel (local
 * `next dev`, tests) it falls back to awaiting inline so behaviour stays correct.
 *
 * Rejections are caught and logged here rather than left to become unhandled
 * rejections — a failed notification must never take down the request that
 * triggered it, but it must not vanish silently either.
 */
export function afterResponse(label: string, work: Promise<unknown>): void {
  const guarded = work.catch((err: unknown) => {
    console.error(`[after-response] ${label} failed:`, err);
  });

  try {
    waitUntil(guarded);
  } catch {
    // Not running on Vercel (or outside a request scope) — the promise is still
    // in flight and guarded; nothing further to do.
    void guarded;
  }
}
