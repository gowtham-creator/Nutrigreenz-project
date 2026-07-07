/**
 * GET /api/admin/reports — the admin reporting aggregates.
 *
 * Admin/superadmin-gated (shared cookie + `verifyToken` guard). Returns real
 * figures over `public.orders` / `public.order_items` / `public.customers`:
 * total revenue (non-cancelled), order count, AOV, status + payment breakdowns,
 * top products by revenue/qty, coupon usage and new-customer counts. Accepts an
 * optional `from`/`to` date range (YYYY-MM-DD or ISO) and a `topLimit` for the
 * product table. Money is integer paise throughout.
 *
 * When Supabase is unconfigured the response is a well-formed empty report so the
 * UI shows its empty state, never an error.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../inventory/guard";
import { buildAdminReport, type AdminReport } from "@/lib/reports";

export const runtime = "nodejs";

function emptyReport(from: string | null, to: string | null): AdminReport {
  return {
    range: { from, to },
    revenuePaise: 0,
    orderCount: 0,
    aovPaise: 0,
    unitsSold: 0,
    paidRevenuePaise: 0,
    statusBreakdown: [],
    paymentBreakdown: [],
    topProducts: [],
    couponUsage: [],
    newCustomers: 0,
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.trim() || null;
  const to = url.searchParams.get("to")?.trim() || null;

  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, report: emptyReport(from, to) });
  }

  const topLimitRaw = Number(url.searchParams.get("topLimit"));
  const topLimit =
    Number.isFinite(topLimitRaw) && topLimitRaw > 0 ? topLimitRaw : undefined;

  const report = await buildAdminReport({ from, to, topLimit });
  return Response.json({ ok: true, report });
}
