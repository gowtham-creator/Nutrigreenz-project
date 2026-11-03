import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { runDueSchedules } from "@/lib/offline-campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/offline-campaigns — send the repeating SMS campaigns that are due.
 *
 * Runs once a day (vercel.json). Signed with CRON_SECRET like the payments
 * cron, and fails closed without it: an open endpoint here would be a button
 * that texts every offline customer.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  if (!isSupabaseConfigured) return Response.json({ ok: true, ran: 0 });
  try {
    const { ran, results } = await runDueSchedules();
    return Response.json({ ok: true, ran, sent: results.reduce((n, r) => n + r.sent, 0) });
  } catch (err) {
    console.error("[cron] offline campaigns failed:", err);
    return Response.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
