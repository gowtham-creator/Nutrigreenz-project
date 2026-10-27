/**
 * GET /api/admin/orders/summary — the Orders portal's today / this week / this
 * month figures, the open backlog, and the delivery slots with today's counts.
 *
 * Same gate as the orders list: the `orders` permission, then a signed-in admin.
 * Slot rows are read-only here; changing them stays on the super-admin config API.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../guard";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { buildOrderSummary } from "@/lib/order-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  try {
    const summary = await buildOrderSummary();
    return Response.json({ ok: true, summary }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error(`[orders-summary] ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
