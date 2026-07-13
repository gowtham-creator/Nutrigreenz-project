/**
 * GET /api/admin/analytics — Product & Customer analytics aggregates.
 *
 * Admin/superadmin-gated (shared cookie + `verifyToken` guard). Returns real
 * per-product demand signals (units, revenue, wishlist saves, PDP views), a
 * units/revenue/views trend, a weekday-vs-weekend split and a customer sign-in
 * breakdown over `public.orders` / `public.order_items` / `public.products` /
 * `public.wishlists` / `public.product_views` / `public.customer_identities`.
 *
 * Accepts an optional `from`/`to` date range (YYYY-MM-DD or ISO) and a `bucket`
 * of `day` | `month` | `quarter` for the trend granularity. Money is integer
 * paise throughout.
 *
 * When Supabase is unconfigured the response is a well-formed empty payload so
 * the UI shows its empty state, never an error.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../inventory/guard";
import { buildProductAnalytics, type AnalyticsBucket, type ProductAnalytics } from "@/lib/analytics";

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

export async function GET(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.trim() || null;
  const to = url.searchParams.get("to")?.trim() || null;
  const bucket = parseBucket(url.searchParams.get("bucket"));

  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, analytics: emptyAnalytics(from, to, bucket) });
  }

  const analytics = await buildProductAnalytics({ from, to, bucket });
  return Response.json({ ok: true, analytics });
}
