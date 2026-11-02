import { getPublicLoyaltyConfig } from "@/lib/rewards";

// Always evaluated at request time — never statically pre-rendered at build.
export const dynamic = "force-dynamic";

/**
 * Public storefront read of the live loyalty programme economics — NO auth.
 * Returns only the customer-facing subset (earn / redeem rates, the min-redeem
 * floor, the max-redeem % cap and the earn on/off switch) via
 * `getPublicLoyaltyConfig()`. The checkout Harvest Coins UI reads this so the
 * points it shows match the Super Admin config instead of a hardcoded guess.
 *
 * Falls back to the built-in defaults when the DB is unconfigured, so the
 * storefront never breaks.
 */
export async function GET(): Promise<Response> {
  try {
    const config = await getPublicLoyaltyConfig();
    return Response.json(
      { ok: true, config },
      // Never cached. The CDN honoured the old max-age and stale-while-revalidate
      // (up to six minutes), and the browser's no-store does not reach past it,
      // while the server always charges from the live config: the storefront
      // could quote a redeem rate the order would not honour.
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
