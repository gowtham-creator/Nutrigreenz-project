import { requireSuperAdmin } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { couponPerformance } from "@/lib/coupon-performance";

export const runtime = "nodejs";
// Redemptions land continuously; a cached figure would be wrong within minutes.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketing/coupons/performance — real redemption figures.
 *
 * Returns only coupons that have actually been redeemed. A coupon absent from
 * this list has never been used, and the UI says exactly that rather than
 * rendering zeros that look like a measurement.
 *
 * Returns 503 rather than an empty list when the database is unreachable: an
 * empty list here is indistinguishable from "no coupon has ever been redeemed",
 * and that is a conclusion an operator might act on.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const days = Number(new URL(request.url).searchParams.get("days") ?? "");
  const sinceIso =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 86_400_000).toISOString()
      : undefined;

  const perf = await couponPerformance({ sinceIso });
  return Response.json({ ok: true, items: [...perf.values()] });
}
