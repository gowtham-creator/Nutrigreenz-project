/**
 * Automatic "Best Seller" / "Selling Fast" badges, derived from real order
 * history rather than set by hand.
 *
 * ── The honesty problem, and why the floors exist ─────────────────────────
 *
 * A badge like this is a claim to the customer: other people bought this. It is
 * only worth showing when that is true, and the catalogue does not have the
 * volume yet — at the time of writing there are 12 orders, 3 of them paid,
 * across 14 line items and 6 distinct products.
 *
 * Ranked naively, the "best seller" of that set has sold two or three units.
 * Printing a gold rosette on it would be a straightforwardly false claim, and
 * the kind a customer notices when the reviews say otherwise.
 *
 * So every rule below has an absolute floor as well as a rank. Until a product
 * clears the floor it carries no badge, whatever its position in the ranking.
 * With today's data that means no badges appear at all, which is the correct
 * output. They begin to appear on their own as real orders arrive, with no
 * migration and nothing to switch on a second time.
 *
 * ── Paid orders only ──────────────────────────────────────────────────────
 *
 * Units are counted from PAID orders. A pending or failed order is not a sale,
 * and counting them would let anyone inflate a product's badge by filling a
 * basket and abandoning it at the payment page.
 */
import "server-only";

import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/** Which badge a product has earned, if any. */
export type AutoBadge = "best-seller" | "selling-fast";

/** Thresholds, in one place so they can be tuned as volume grows. */
export const BADGE_RULES = {
  /**
   * Minimum lifetime PAID units before "Best Seller" can appear at all.
   *
   * Deliberately not 1. The badge means "this is what people buy here", and a
   * product cannot demonstrate that on a handful of orders.
   */
  bestSellerMinUnits: 25,
  /** How many products may hold "Best Seller" at once, ranked by paid units. */
  bestSellerMaxProducts: 3,

  /** Minimum units sold inside the recent window before "Selling Fast" shows. */
  sellingFastMinUnits: 10,
  /** The window that counts as "recent", in days. */
  sellingFastWindowDays: 14,
} as const;

/** Paid unit counts for one product, lifetime and recent. */
export interface ProductSales {
  productId: string;
  /** Units on paid orders, all time. */
  units: number;
  /** Units on paid orders inside the recent window. */
  recentUnits: number;
}

/**
 * Paid unit counts per product.
 *
 * Best-effort: returns an empty map when Supabase is unconfigured or the query
 * fails, so a reporting hiccup costs the storefront a badge rather than a page.
 */
export async function getProductSales(): Promise<Map<string, ProductSales>> {
  const out = new Map<string, ProductSales>();
  if (!isSupabaseConfigured) return out;

  try {
    const since = new Date(
      Date.now() - BADGE_RULES.sellingFastWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const db = supabaseAdmin();
    // Join through orders so only PAID lines are counted; an unpaid basket is
    // not a sale and must not move a badge.
    const { data, error } = await db
      .from("order_items")
      .select("product_id, qty, orders!inner(payment_status, created_at)")
      .eq("orders.payment_status", "paid")
      .not("product_id", "is", null);
    if (error || !data) return out;

    type Row = {
      product_id: string | null;
      qty: number | null;
      orders: { payment_status: string; created_at: string } | null;
    };

    for (const row of data as unknown as Row[]) {
      const id = row.product_id;
      if (!id) continue;
      const qty = Number(row.qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const entry = out.get(id) ?? { productId: id, units: 0, recentUnits: 0 };
      entry.units += qty;
      if (row.orders?.created_at && row.orders.created_at >= since) {
        entry.recentUnits += qty;
      }
      out.set(id, entry);
    }
  } catch {
    return out;
  }
  return out;
}

/**
 * Decide each product's badge from the sales map.
 *
 * Returned as a map rather than computed per product because "Best Seller" is a
 * RANK: whether one product qualifies depends on every other product's numbers,
 * so it cannot be decided in isolation.
 *
 * A product that qualifies for both gets "Best Seller". It is the stronger and
 * more durable claim, and two badges on one card is noise.
 */
export function deriveAutoBadges(sales: Map<string, ProductSales>): Map<string, AutoBadge> {
  const badges = new Map<string, AutoBadge>();
  const all = [...sales.values()];

  const bestSellers = all
    .filter((s) => s.units >= BADGE_RULES.bestSellerMinUnits)
    .sort((a, b) => b.units - a.units)
    .slice(0, BADGE_RULES.bestSellerMaxProducts);
  for (const s of bestSellers) badges.set(s.productId, "best-seller");

  for (const s of all) {
    if (badges.has(s.productId)) continue; // Best Seller already claimed it.
    if (s.recentUnits >= BADGE_RULES.sellingFastMinUnits) {
      badges.set(s.productId, "selling-fast");
    }
  }
  return badges;
}

/** The label and tone each badge renders with. */
export const BADGE_PRESENTATION: Record<AutoBadge, { label: string; icon: string }> = {
  "best-seller": { label: "Best Seller", icon: "star" },
  "selling-fast": { label: "Selling Fast", icon: "bolt" },
};
