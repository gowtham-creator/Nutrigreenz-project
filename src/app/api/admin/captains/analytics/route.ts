import { requireApiPermission } from "@/lib/admin-api-guard";
import { captainAnalytics } from "@/lib/captain-analytics";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
// Real-time, like the sales route beside it: an operator checking a captain's
// day must not get a cached answer.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/captains/analytics — stall sales by period and date range.
 *
 * Query, all optional: `captainId`, `community`, and `from` / `to` as IST days
 * (YYYY-MM-DD, both inclusive). The range defaults to this month.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const param = (key: string) => url.searchParams.get(key)?.trim() || undefined;
  try {
    const analytics = await captainAnalytics({
      captainId: param("captainId"),
      community: param("community"),
      from: param("from"),
      to: param("to"),
    });
    return Response.json({ ok: true, analytics }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[captains] analytics failed:", err);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
