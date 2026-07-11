import { getHeroPromotion } from "@/lib/promotions";

// Always evaluated at request time — never statically pre-rendered at build.
export const dynamic = "force-dynamic";

/**
 * Public storefront read of the single LIVE hero promotion — NO auth. Returns
 * the display-resolved sale (auto-month substitution already applied) as
 * `{ bannerKey, title, headline, subcopy, discountPercent, ctaLabel, ctaHref }`,
 * or `{ promotion: null }` when no occasion/seasonal sale is running.
 *
 * Short cache-control (60s + SWR) keeps the banner cheap; the resolver falls back
 * to null when the DB is unconfigured, so the storefront never breaks.
 */
export async function GET(): Promise<Response> {
  const headers = { "cache-control": "public, max-age=60, stale-while-revalidate=300" };
  try {
    const hero = await getHeroPromotion();
    if (!hero) {
      return Response.json({ promotion: null }, { headers });
    }
    return Response.json(
      {
        bannerKey: hero.bannerKey,
        title: hero.title,
        headline: hero.headline,
        subcopy: hero.subcopy,
        discountPercent: hero.discountPercent,
        ctaLabel: hero.ctaLabel,
        ctaHref: hero.ctaHref,
      },
      { headers },
    );
  } catch {
    return Response.json({ promotion: null }, { headers });
  }
}
