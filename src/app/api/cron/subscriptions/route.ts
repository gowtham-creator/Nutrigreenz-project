/**
 * GET /api/cron/subscriptions — the daily subscription run.
 *
 * Ends paused subscriptions whose pause is over, marks unpaid past deliveries
 * missed, and writes the deliveries that fall inside the lead window (placing
 * cash on delivery orders, emailing pay-online customers). Every step is
 * idempotent, so a retried or doubled run produces the same result.
 *
 * Schedule: `crons` in vercel.json (daily, early morning IST).
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runSubscriptionCycle } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Same rule as the reconcile cron: CRON_SECRET bearer, fail closed when unset. */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, skipped: "unavailable" });
  }
  if (!(await isFeatureEnabled("subscriptions"))) {
    return Response.json({ ok: true, skipped: "feature-off" });
  }
  try {
    const summary = await runSubscriptionCycle();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error(`subscription-cycle-failed: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: "cycle-failed" }, { status: 500 });
  }
}
