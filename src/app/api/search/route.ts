import { NextResponse } from "next/server";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";

/**
 * Storefront search — products and categories.
 *
 * ── Why this is server-side at all ────────────────────────────────────────
 *
 * The catalogue is small enough that the header could have been handed every
 * product and filtered in the browser. It is not, for two reasons: the header
 * renders on every page, so that payload would be paid for on every page by
 * every visitor whether or not they ever open search; and the catalogue is
 * already revalidated server-side, so a client copy would be a second source
 * of truth going stale on its own schedule.
 *
 * ── Matching ──────────────────────────────────────────────────────────────
 *
 * Title, subtitle, unit and tags, case-insensitively, all terms required.
 * Every term must appear somewhere, but not necessarily in the same field —
 * "sesame 500" finds the 500ml sesame oil, where a whole-string match on the
 * title alone finds nothing, because the size lives in `unit`.
 *
 * Ranking puts a title-prefix match first ("hon" → Honey before Wild Forest
 * Honey), then anything else matched in the title, then matches that only hit
 * a tag or the unit. Within a band the better-rated product wins: these are
 * groceries, and at this catalogue size there is no more useful signal.
 *
 * ── Why categories come back too ──────────────────────────────────────────
 *
 * Searching "oil" should be able to answer "we have a whole section of those"
 * rather than listing eight bottles and leaving the shopper to work out that a
 * category exists. Products still lead — someone typing a product name wants
 * the product — but the category is offered alongside.
 */

export const revalidate = 60;

const MAX_PRODUCTS = 6;
const MAX_CATEGORIES = 3;

export interface SearchProductHit {
  slug: string;
  title: string;
  image: string;
  price: number;
  mrp: number | null;
  unit: string | null;
  badge: string | null;
  inStock: boolean;
}

export interface SearchCategoryHit {
  slug: string;
  title: string;
  count: number;
}

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  // One character matches most of the catalogue and is nearly always a
  // keystroke on the way to a real query rather than a query.
  if (q.length < 2) {
    return NextResponse.json({ ok: true, query: q, products: [], categories: [], total: 0 });
  }

  const terms = q.split(/\s+/).filter(Boolean);

  try {
    const { products, categories } = await getStorefrontCatalog();

    const matched = products
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
      .sort((a, b) => a.rank - b.rank || b.p.rating - a.p.rating);

    const categoryHits: SearchCategoryHit[] = categories
      .filter((c) => {
        const name = c.title.toLowerCase();
        return terms.every((t) => name.includes(t) || c.slug.includes(t));
      })
      .slice(0, MAX_CATEGORIES)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        // Counted off the live catalogue rather than read from the category
        // record, whose stored count goes stale the moment a product is
        // published or pulled.
        count: products.filter((p) => p.tags?.includes(c.slug)).length,
      }));

    const productHits: SearchProductHit[] = matched.slice(0, MAX_PRODUCTS).map(({ p }) => ({
      slug: p.slug,
      title: p.title,
      image: p.image,
      price: p.price,
      mrp: p.mrp ?? null,
      unit: p.unit ?? null,
      badge: p.badge ?? null,
      inStock: (p.badge ?? "").toLowerCase() !== "sold out",
    }));

    return NextResponse.json({
      ok: true,
      query: q,
      products: productHits,
      categories: categoryHits,
      // The full count, not the truncated one — the panel says "see all 11
      // results", which has to be true.
      total: matched.length,
    });
  } catch {
    // Search failing must never surface as an error over the storefront. An
    // empty result reads as "nothing found" and is recoverable by typing
    // something else; a thrown route is not.
    return NextResponse.json({ ok: true, query: q, products: [], categories: [], total: 0 });
  }
}
