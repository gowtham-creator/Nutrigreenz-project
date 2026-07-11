import { getActivePromoMessages } from "@/lib/promotions";

/**
 * Public marquee lines for the storefront top announcement bar — one per active
 * promotion (explicit announcement, else derived from title + discount). The
 * PromoBar fetches this on mount; empty array when no sale is live.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const messages = await getActivePromoMessages().catch(() => []);
  return Response.json(
    { messages },
    { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=300" } },
  );
}
