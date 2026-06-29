/**
 * Pure pricing helpers for checkout — coupon validation, loyalty redemption,
 * shipping and grand-total math. Kept framework-free so it's trivially testable
 * and reusable by both the checkout form and the confirmation page.
 */

import type { Coupon, CommerceRules, LoyaltyLedgerEntry } from "@/types/nutrigreenz";

/**
 * Default loyalty conversion: 10 points = ₹1.
 *
 * This is the *fallback* ratio. The live value is configured by the Super Admin
 * (`useLoyaltyConfig().config.redeemPointsPerRupee`) and passed into the helpers
 * below; this constant is used when no override is supplied.
 */
export const POINTS_PER_RUPEE = 10;

/** Current loyalty balance = the latest ledger entry's running balance. */
export function loyaltyBalance(ledger: LoyaltyLedgerEntry[]): number {
  if (ledger.length === 0) return 0;
  return ledger[ledger.length - 1].balanceAfter;
}

/**
 * Max ₹ value redeemable from a points balance (floored to whole rupees).
 *
 * `pointsPerRupee` defaults to {@link POINTS_PER_RUPEE} so existing callers keep
 * working; checkout passes the Super-Admin-configured ratio.
 */
export function maxRedeemableRupees(
  points: number,
  pointsPerRupee: number = POINTS_PER_RUPEE,
): number {
  const ratio = pointsPerRupee > 0 ? pointsPerRupee : POINTS_PER_RUPEE;
  return Math.floor(points / ratio);
}

export type CouponError =
  | "not-found"
  | "inactive"
  | "expired"
  | "below-min";

export interface CouponResult {
  ok: boolean;
  coupon?: Coupon;
  /** Discount in ₹ (already capped by maxDiscount for percent coupons). */
  discount: number;
  error?: CouponError;
}

export const COUPON_ERROR_MESSAGE: Record<CouponError, string> = {
  "not-found": "That code isn't valid. Check the spelling and try again.",
  inactive: "This coupon is no longer active.",
  expired: "This coupon has expired.",
  "below-min": "Your order doesn't meet this coupon's minimum value yet.",
};

/**
 * Validate a coupon code against the catalogue + cart subtotal, returning the
 * applicable discount. `now` is injectable for deterministic tests.
 */
export function validateCoupon(
  code: string,
  subtotal: number,
  coupons: Coupon[],
  now: Date = new Date(),
): CouponResult {
  const normalized = code.trim().toUpperCase();
  const coupon = coupons.find((c) => c.code.toUpperCase() === normalized);

  if (!coupon) return { ok: false, discount: 0, error: "not-found" };
  if (!coupon.active) return { ok: false, discount: 0, error: "inactive" };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now.getTime()) {
    return { ok: false, discount: 0, error: "expired" };
  }
  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return { ok: false, discount: 0, error: "below-min" };
  }

  const raw =
    coupon.type === "percent"
      ? (subtotal * coupon.value) / 100
      : coupon.value;
  const capped =
    coupon.type === "percent" && coupon.maxDiscount
      ? Math.min(raw, coupon.maxDiscount)
      : raw;
  // Never discount more than the subtotal itself.
  const discount = Math.round(Math.min(capped, subtotal));

  return { ok: true, coupon, discount };
}

/**
 * Delivery fee for a given subtotal, honouring the live commerce rules:
 * - "zero" shipping type → always free
 * - at/above the free-delivery threshold → free
 * - "slab" → the fee of the first slab whose `upto` ≥ subtotal (else the flat fee)
 * - otherwise → the flat fee
 */
export function computeShipping(subtotal: number, rules: CommerceRules): number {
  if (rules.shippingType === "zero") return 0;
  if (subtotal >= rules.freeDeliveryThreshold) return 0;

  if (rules.shippingType === "slab" && rules.shippingSlabs && rules.shippingSlabs.length > 0) {
    const slabs = [...rules.shippingSlabs].sort((a, b) => a.upto - b.upto);
    for (const slab of slabs) {
      if (subtotal <= slab.upto) return Math.max(0, Math.round(slab.fee));
    }
    // Above every configured slab — fall back to the flat fee.
    return Math.max(0, Math.round(rules.shippingFlat));
  }

  return Math.max(0, Math.round(rules.shippingFlat));
}

/**
 * Tax added on top of the taxable base. Only "exclusive" tax mode adds a line;
 * "inclusive" pricing already bakes tax into the displayed prices (returns 0).
 */
export function computeTax(taxableBase: number, rules: CommerceRules): number {
  if (rules.taxMode !== "exclusive") return 0;
  const bps = rules.taxRateBps ?? 0;
  if (bps <= 0) return 0;
  return Math.round((Math.max(0, taxableBase) * bps) / 10000);
}

export interface OrderTotals {
  subtotal: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  shipping: number;
  /** Free shipping threshold from commerce rules. */
  freeDeliveryThreshold: number;
  /** Tax added on top (₹) — 0 when prices are tax-inclusive. */
  tax: number;
  /** Tax rate in basis points (for the tax-line label). */
  taxRateBps: number;
  total: number;
  taxInclusive: boolean;
}

/**
 * Compute the order total. Coupon + loyalty are subtracted from the subtotal;
 * shipping follows the commerce rule (flat/slab/zero, free above the threshold);
 * exclusive tax is added on the discounted goods.
 */
export function computeTotals(args: {
  subtotal: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  rules: CommerceRules;
}): OrderTotals {
  const { subtotal, couponDiscount, loyaltyDiscount, rules } = args;
  const shipping = computeShipping(subtotal, rules);
  const discounted = Math.max(0, subtotal - couponDiscount - loyaltyDiscount);
  const tax = computeTax(discounted, rules);
  const total = discounted + shipping + tax;
  return {
    subtotal,
    couponDiscount,
    loyaltyDiscount,
    shipping,
    freeDeliveryThreshold: rules.freeDeliveryThreshold,
    tax,
    taxRateBps: rules.taxMode === "exclusive" ? rules.taxRateBps ?? 0 : 0,
    total,
    taxInclusive: rules.taxMode === "inclusive",
  };
}

/** Generate a customer-facing order id like `NG-25-1099`. */
export function generateOrderId(): string {
  const seq = 1000 + Math.floor(Math.random() * 9000);
  return `NG-25-${seq}`;
}

/** Loyalty points earned on an order — 1 point per ₹10 spent (rounded down). */
export function pointsEarned(total: number): number {
  return Math.floor(total / 10);
}

export const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
