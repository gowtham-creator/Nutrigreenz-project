/**
 * Server-owned wishlist data-access + aggregation (Supabase `public.wishlists`).
 *
 * Promotes the wishlist from a per-browser localStorage store to a durable,
 * customer-scoped table so a signed-in customer's saves survive across devices
 * and the admin can aggregate real demand (top saved products + saver counts).
 *
 * Service-role only — import from Node route handlers, never client/Edge. RLS on
 * `public.wishlists` has no policies, so only the service-role client (which
 * bypasses RLS) can touch it. Customer reads/writes are scoped strictly to the
 * signed-in customer's own `customerId`; aggregation is admin-gated.
 *
 * Each row is a (customer_id, product_slug) save; the pair is UNIQUE, so a
 * re-save is idempotent (ignored) and the per-product saver count equals its row
 * count. Product metadata (title/image/price) is hydrated from the storefront
 * catalogue at read time — the table stores only the slug.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";
import type { ProductCard } from "@/types/nutrigreenz";

/* ── record shapes ────────────────────────────────────────────────────── */

/** One saved product for a customer (newest saved first when listed). */
export interface WishlistEntry {
  productSlug: string;
  createdAt: string;
}

/** Aggregated demand for a single product across all customers. */
export interface WishlistProductStat {
  slug: string;
  title: string;
  image: string;
  href: string;
  /** Listing price in integer paise (money is paise end to end). */
  pricePaise: number;
  /** Distinct customers who saved this product. */
  savers: number;
}

/** The admin wishlist report: headline totals + the ranked saved products. */
export interface WishlistReport {
  /** Total save rows (== savers, since a product is saved once per customer). */
  totalSaves: number;
  /** Distinct products that appear on at least one wishlist. */
  distinctProducts: number;
  /** Distinct customers with at least one saved product. */
  distinctSavers: number;
  /** Top saved products by saver count (desc), hydrated with catalogue data. */
  topProducts: WishlistProductStat[];
}

interface WishlistRow {
  customer_id: string;
  product_slug: string;
  created_at: string;
}

/** Paise from the storefront `ProductCard` price (which is whole rupees). */
function priceToPaise(rupees: number): number {
  return Math.max(0, Math.round(rupees * 100));
}

function cleanSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/* ── customer-scoped reads/writes ─────────────────────────────────────── */

/** A customer's saved slugs, newest saved first. */
export async function listWishlistEntries(
  customerId: string,
): Promise<WishlistEntry[]> {
  const { data } = await supabaseAdmin()
    .from("wishlists")
    .select("product_slug, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return ((data as { product_slug: string; created_at: string }[] | null) ?? []).map(
    (r) => ({ productSlug: r.product_slug, createdAt: r.created_at }),
  );
}

/**
 * A customer's saved products hydrated to storefront `ProductCard`s, newest
 * saved first. Slugs no longer in the live catalogue are dropped silently.
 */
export async function listWishlistProducts(
  customerId: string,
): Promise<ProductCard[]> {
  const entries = await listWishlistEntries(customerId);
  if (entries.length === 0) return [];

  // One catalogue read, then index by slug — avoids an N+1 per-slug fetch.
  const catalog = await getStorefrontCatalog();
  const bySlug = new Map<string, ProductCard>();
  for (const p of catalog.products) bySlug.set(p.slug, p);

  const cards: ProductCard[] = [];
  for (const entry of entries) {
    const card = bySlug.get(entry.productSlug);
    if (card) cards.push(card);
  }
  return cards;
}

/** Save one product for a customer (idempotent — a re-save is ignored). */
export async function addToWishlist(
  customerId: string,
  productSlug: string,
): Promise<boolean> {
  const slug = cleanSlug(productSlug);
  if (!slug) return false;
  const { error } = await supabaseAdmin()
    .from("wishlists")
    .upsert(
      { customer_id: customerId, product_slug: slug },
      { onConflict: "customer_id,product_slug", ignoreDuplicates: true },
    );
  return !error;
}

/**
 * Save many products at once (idempotent bulk upsert). Used to fold a guest /
 * this-account's local wishlist into the DB on sign-in without duplicating.
 */
export async function addManyToWishlist(
  customerId: string,
  slugs: string[],
): Promise<boolean> {
  const rows = Array.from(
    new Set(slugs.map(cleanSlug).filter((s): s is string => s !== null)),
  ).map((slug) => ({ customer_id: customerId, product_slug: slug }));
  if (rows.length === 0) return true;
  const { error } = await supabaseAdmin()
    .from("wishlists")
    .upsert(rows, { onConflict: "customer_id,product_slug", ignoreDuplicates: true });
  return !error;
}

/** Remove one saved product for a customer. */
export async function removeFromWishlist(
  customerId: string,
  productSlug: string,
): Promise<boolean> {
  const slug = cleanSlug(productSlug);
  if (!slug) return false;
  const { error } = await supabaseAdmin()
    .from("wishlists")
    .delete()
    .eq("customer_id", customerId)
    .eq("product_slug", slug);
  return !error;
}

/** Empty a customer's entire wishlist. */
export async function clearWishlist(customerId: string): Promise<boolean> {
  const { error } = await supabaseAdmin()
    .from("wishlists")
    .delete()
    .eq("customer_id", customerId);
  return !error;
}

/* ── admin aggregation ────────────────────────────────────────────────── */

/**
 * Aggregate every wishlist row into headline totals + the ranked top saved
 * products (by distinct saver count). Product metadata is hydrated from the
 * storefront catalogue; a saved slug missing from the catalogue still counts
 * toward demand but carries a fallback title so the report is never blank.
 */
export async function aggregateWishlists(limit = 20): Promise<WishlistReport> {
  const cap = Math.min(100, Math.max(1, Math.round(limit)));

  const { data } = await supabaseAdmin()
    .from("wishlists")
    .select("customer_id, product_slug, created_at");
  const rows = (data as WishlistRow[] | null) ?? [];

  const saversBySlug = new Map<string, number>();
  const savers = new Set<string>();
  for (const row of rows) {
    saversBySlug.set(row.product_slug, (saversBySlug.get(row.product_slug) ?? 0) + 1);
    savers.add(row.customer_id);
  }

  // Rank slugs by saver count, then hydrate just the top `cap` from the catalog.
  const ranked = Array.from(saversBySlug.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap);

  const catalog = await getStorefrontCatalog();
  const bySlug = new Map<string, ProductCard>();
  for (const p of catalog.products) bySlug.set(p.slug, p);

  const topProducts: WishlistProductStat[] = ranked.map(([slug, count]) => {
    const card = bySlug.get(slug);
    return {
      slug,
      title: card?.title ?? slug,
      image: card?.image ?? "",
      href: card?.href ?? `/products/${slug}`,
      pricePaise: card ? priceToPaise(card.price) : 0,
      savers: count,
    };
  });

  return {
    totalSaves: rows.length,
    distinctProducts: saversBySlug.size,
    distinctSavers: savers.size,
    topProducts,
  };
}
