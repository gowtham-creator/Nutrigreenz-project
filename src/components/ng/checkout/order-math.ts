/**
 * Pure pricing helpers for checkout — coupon validation, loyalty redemption,
 * shipping and grand-total math. Kept framework-free so it's trivially testable
 * and reusable by both the checkout form and the confirmation page.
 */

import type { Coupon, CommerceRules, LoyaltyLedgerEntry } from "@/types/nutrigreenz";

/** 10 loyalty points = ₹1. */
export const POINTS_PER_RUPEE = 10;

/** Current loyalty balance = the latest ledger entry's running balance. */
export function loyaltyBalance(ledger: LoyaltyLedgerEntry[]): number {
  if (ledger.length === 0) return 0;
  return ledger[ledger.length - 1].balanceAfter;
}

/** Max ₹ value redeemable from a points balance (floored to whole rupees). */
export function maxRedeemableRupees(points: number): number {
  return Math.floor(points / POINTS_PER_RUPEE);
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

export interface OrderTotals {
  subtotal: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  shipping: number;
  /** Free shipping threshold from commerce rules. */
  freeDeliveryThreshold: number;
  total: number;
  taxInclusive: boolean;
}

/**
 * Compute the order total. Coupon + loyalty are subtracted from the subtotal;
 * shipping is free at/above the free-delivery threshold, else the flat fee.
 */
export function computeTotals(args: {
  subtotal: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  rules: CommerceRules;
}): OrderTotals {
  const { subtotal, couponDiscount, loyaltyDiscount, rules } = args;
  const shipping =
    subtotal >= rules.freeDeliveryThreshold ? 0 : rules.shippingFlat;
  const discounted = Math.max(0, subtotal - couponDiscount - loyaltyDiscount);
  const total = discounted + shipping;
  return {
    subtotal,
    couponDiscount,
    loyaltyDiscount,
    shipping,
    freeDeliveryThreshold: rules.freeDeliveryThreshold,
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
