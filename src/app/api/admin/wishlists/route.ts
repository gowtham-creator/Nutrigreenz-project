/**
 * GET /api/admin/wishlists — real wishlist demand aggregation.
 *
 * Admin/superadmin-gated (shared cookie + `verifyToken` guard). Aggregates every
 * row in `public.wishlists` into headline totals + the top saved products ranked
 * by distinct saver count, hydrating each product's title/image/price from the
 * live catalogue. `limit` (1–100, default 20) caps the ranked list.
 *
 * When Supabase is unconfigured the response is a well-formed empty report so the
 * UI shows its empty state, never an error.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../inventory/guard";
import { aggregateWishlists } from "@/lib/wishlist-store";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({
      ok: true,
      report: { totalSaves: 0, distinctProducts: 0, distinctSavers: 0, topProducts: [] },
    });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const report = await aggregateWishlists(limit);
  return Response.json({ ok: true, report });
}
