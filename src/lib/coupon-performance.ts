import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/**
 * What a coupon actually did — read from `coupon_uses` joined to the orders it
 * discounted.
 *
 * This replaces the campaign builder's invented figures. That panel showed four
 * codes with hardcoded stats (FRESH50 "1,840 issued / 612 redeemed / ₹2,48,900
 * revenue"), sitting on the same page as the real coupon manager. An operator
 * comparing the two saw confident, precise, entirely fictional numbers for codes
 * that in most cases had never been redeemed.
 *
 * There is deliberately no "issued" figure here. These are public codes typed at
 * checkout, not vouchers handed to named customers — nothing issues them, so a
 * redemption RATE has no denominator and any number shown would be invented. The
 * panel drops that metric rather than showing a zero that reads like a fact.
 */

export interface CouponPerformance {
  couponId: string;
  code: string;
  /** Rows in coupon_uses — every accepted redemption. */
  redemptions: number;
  /** Distinct customers who used it, so one heavy user is not read as reach. */
  customers: number;
  /**
   * Order value the code brought in: the total of the orders it was used on.
   * Only PAID orders count — an unpaid order is not revenue.
   */
  revenuePaise: number;
  /**
   * Discount actually given, in paise.
   *
   * NOT orders.discount_paise: that column carries the coupon discount AND any
   * loyalty points burned on the same order. Charging the loyalty burn to the
   * coupon would overstate its cost and flatter its ROI, so the loyalty portion
   * is subtracted back out.
   */
  discountPaise: number;
  /** Redemptions whose order has not been paid — counted, never billed as revenue. */
  unpaidRedemptions: number;
  lastRedeemedAt: string | null;
}

interface UseRow {
  coupon_id: string;
  customer_id: string | null;
  created_at: string;
  orders: {
    payment_status: string;
    total_paise: number;
    discount_paise: number;
    loyalty_redeemed_paise: number;
  } | null;
}

/**
 * Performance for every coupon that has ever been redeemed.
 *
 * Coupons with no redemptions are absent from the result rather than present
 * with zeros — the caller pairs this with the coupon list and shows "not yet
 * redeemed", which is a true statement, where a row of zeros looks like a
 * measurement.
 */
export async function couponPerformance(opts: { sinceIso?: string } = {}): Promise<
  Map<string, CouponPerformance>
> {
  const out = new Map<string, CouponPerformance>();
  if (!isSupabaseConfigured) return out;

  let q = supabaseAdmin()
    .from("coupon_uses")
    .select(
      "coupon_id, customer_id, created_at, orders(payment_status, total_paise, discount_paise, loyalty_redeemed_paise)",
    );
  if (opts.sinceIso) q = q.gte("created_at", opts.sinceIso);

  const { data, error } = await q;
  if (error || !data) return out;

  // coupon_id → the customers who redeemed it, so repeat use is not counted twice.
  const seen = new Map<string, Set<string>>();

  for (const raw of data as unknown as UseRow[]) {
    const id = raw.coupon_id;
    const order = Array.isArray(raw.orders) ? raw.orders[0] : raw.orders;

    const row =
      out.get(id) ??
      {
        couponId: id,
        code: "",
        redemptions: 0,
        customers: 0,
        revenuePaise: 0,
        discountPaise: 0,
        unpaidRedemptions: 0,
        lastRedeemedAt: null,
      };

    row.redemptions += 1;
    if (!row.lastRedeemedAt || raw.created_at > row.lastRedeemedAt) {
      row.lastRedeemedAt = raw.created_at;
    }

    if (raw.customer_id) {
      const bucket = seen.get(id) ?? new Set<string>();
      bucket.add(raw.customer_id);
      seen.set(id, bucket);
    }

    if (order && order.payment_status === "paid") {
      row.revenuePaise += order.total_paise;
      // Strip the loyalty burn: only the coupon's own discount is its cost.
      const couponShare = Math.max(
        0,
        order.discount_paise - order.loyalty_redeemed_paise,
      );
      row.discountPaise += couponShare;
    } else {
      row.unpaidRedemptions += 1;
    }

    out.set(id, row);
  }

  for (const [id, row] of out) row.customers = seen.get(id)?.size ?? 0;

  // Label the rows with their codes so the UI does not have to join on ids.
  const ids = [...out.keys()];
  if (ids.length > 0) {
    const { data: codes } = await supabaseAdmin()
      .from("coupons")
      .select("id, code")
      .in("id", ids);
    for (const c of (codes ?? []) as { id: string; code: string }[]) {
      const row = out.get(c.id);
      if (row) row.code = c.code;
    }
  }

  return out;
}

/**
 * Return on the discount, as a multiple.
 *
 * `null` when nothing has been discounted yet — a coupon with no cost has no
 * meaningful ratio, and printing "0×" or "∞" would both mislead.
 */
export function couponRoi(p: { revenuePaise: number; discountPaise: number }): number | null {
  if (p.discountPaise <= 0) return null;
  return p.revenuePaise / p.discountPaise;
}
