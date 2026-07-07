/**
 * GET /api/admin/orders/bundles — real community-bundle aggregation.
 *
 * Admin/superadmin-gated (shared cookie + `verifyToken` guard). Groups the real
 * pre-dispatch orders (placed / confirmed / packed) by gated community + pincode
 * (from `address_snapshot`) and delivery date (from `slot_snapshot`), returning
 * bundle groups with order counts, per-order summaries and consolidated SKU
 * quantities for packing. Replaces the mock `bundle-data` source.
 *
 * When Supabase is unconfigured the response is a well-formed empty result so the
 * UI shows its empty state, never an error.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../guard";
import { buildOrderBundles } from "@/lib/order-bundles";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({
      ok: true,
      groups: [],
      deliveryDates: [],
      totals: { groups: 0, orders: 0, bundleTotalPaise: 0 },
    });
  }

  const result = await buildOrderBundles();
  return Response.json({ ok: true, ...result });
}
