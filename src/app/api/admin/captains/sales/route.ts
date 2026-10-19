import { requireApiPermission } from "@/lib/admin-api-guard";
import { captainSalesSummary } from "@/lib/captain-allocations";

export const runtime = "nodejs";
// Real-time by requirement: an operator asking "what have captains sold today"
// must not be served a cached answer.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/captains/sales — captain stall sales, counted per SKU.
 *
 * Query: `captainId` for one captain (omit for all), `days` for a window.
 *
 * This is a SEPARATE channel from storefront orders and is never merged into
 * them: a stall sale is cash taken in the field against allocated stock, and
 * mixing the two would misstate both.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;

  const url = new URL(request.url);
  const captainId = url.searchParams.get("captainId")?.trim() || undefined;
  // Capped at a year: an absurd window made `new Date()` invalid and threw.
  const days = Math.min(366, Number(url.searchParams.get("days") ?? ""));
  const sinceIso =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 86_400_000).toISOString()
      : undefined;

  const summary = await captainSalesSummary({ captainId, sinceIso });
  return Response.json(
    { ok: true, ...summary },
    { headers: { "cache-control": "no-store" } },
  );
}
