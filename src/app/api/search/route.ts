import { NextResponse } from "next/server";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";

/**
 * Storefront product search.
 *
 * ── Why this is server-side at all ────────────────────────────────────────
 *
 * The catalogue is small enough that the header could have been handed every
 * product and filtered in the browser. It is not, for two reasons: the header
 * renders on every page, so that payload would be paid for on every page by
 * every visitor whether or not they ever open search; and the catalogue is
 * already revalidated server-side, so a client copy would be a second source
 * of truth that goes stale on its own schedule.
 *
 * ── Matching ──────────────────────────────────────────────────────────────
 *
 * Title, subtitle, unit and tags, case-insensitively, all terms required. Every
 * term must appear somewhere, but not necessarily in the same field — "sesame
 * 500" finds the 500ml sesame oil, where a naive whole-string match on the
 * title alone finds nothing, because the size lives in `unit`.
 *
 * Ranking puts a title-prefix match first ("hon" → Honey before Wild Forest
 * Honey), then anything else matched in the title, then the rest. Within a
 * band, the better-rated product wins, since these are groceries and there is
 * no relevance signal more useful than that at this catalogue size.
 */

export const revalidate = 60;

const MAX_RESULTS = 8;

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    // One character matches most of the catalogue and is almost always a
    // keystroke on the way to a real query, not a query.
    return NextResponse.json({ ok: true, query: q, results: [] });
  }

  const terms = q.split(/\s+/).filter(Boolean);

  try {
    const { products } = await getStorefrontCatalog();

    const scored = products
      .map((p) => {
        const title = p.title.toLowerCase();
        const haystack = [title, p.subtitle ?? "", p.unit ?? "", ...(p.tags ?? [])]
          .join(" ")
          .toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return null;

        const rank = title.startsWith(terms[0]) ? 0 : title.includes(terms[0]) ? 1 : 2;
        return { p, rank };
      })
      .filter((x): x is { p: (typeof products)[number]; rank: number } => x !== null)
      .sort((a, b) => a.rank - b.rank || b.p.rating - a.p.rating)
      .slice(0, MAX_RESULTS);

    return NextResponse.json({
      ok: true,
      query: q,
      results: scored.map(({ p }) => ({
        slug: p.slug,
        title: p.title,
        image: p.image,
        price: p.price,
        mrp: p.mrp ?? null,
        unit: p.unit ?? null,
        badge: p.badge ?? null,
      })),
    });
  } catch {
    // Search failing must never surface as an error dialog over the storefront.
    // An empty result reads as "nothing found", which is recoverable by typing
    // something else; a thrown route is not.
    return NextResponse.json({ ok: true, query: q, results: [] });
  }
}
