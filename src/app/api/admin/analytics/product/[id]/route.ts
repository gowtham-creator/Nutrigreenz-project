/**
 * GET /api/admin/analytics/product/[id] — analytics scoped to one product.
 *
 * Admin/superadmin-gated. Same payload shape as `GET /api/admin/analytics`, but
 * the product-level figures (units, revenue, wishlist saves, views, trend and
 * weekday-vs-weekend split) are scoped to the single product `[id]`. The sign-in
 * breakdown remains store-wide (it is a customer signal, not a product one).
 *
 * Accepts the same optional `from`/`to` range and `bucket` params. Money is
 * integer paise throughout.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../../../inventory/guard";
import { buildProductAnalytics, type AnalyticsBucket, type ProductAnalytics } from "@/lib/analytics";
import { requireApiPermission } from "@/lib/admin-api-guard";

export const runtime = "nodejs";

/** Coerce an untrusted `bucket` param to a supported granularity (default day). */
function parseBucket(value: string | null): AnalyticsBucket {
  return value === "month" || value === "quarter" ? value : "day";
}

function emptyAnalytics(from: string | null, to: string | null, bucket: AnalyticsBucket): ProductAnalytics {
  return {
    range: { from, to },
    bucket,
    generatedAt: new Date().toISOString(),
    totals: { unitsSold: 0, revenuePaise: 0, views: 0, wishlistCount: 0, productsTracked: 0 },
    products: [],
    series: [],
    weekend: {
      weekday: { unitsSold: 0, revenuePaise: 0, views: 0 },
      weekend: { unitsSold: 0, revenuePaise: 0, views: 0 },
    },
    signins: { total: 0, providers: [], series: [] },
  };
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("analytics");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.trim() || null;
  const to = url.searchParams.get("to")?.trim() || null;
  const bucket = parseBucket(url.searchParams.get("bucket"));

  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, analytics: emptyAnalytics(from, to, bucket) });
  }

  const analytics = await buildProductAnalytics({ from, to, bucket, productId: id });
  return Response.json({ ok: true, analytics });
}
