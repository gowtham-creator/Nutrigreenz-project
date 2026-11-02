/**
 * Pure pricing helpers for checkout — coupon validation, loyalty redemption,
 * shipping and grand-total math. Kept framework-free so it's trivially testable
 * and reusable by both the checkout form and the confirmation page.
 */

import type { Coupon, CommerceRules, LoyaltyLedgerEntry } from "@/types/nutrigreenz";
import type { LoyaltyConfig } from "@/lib/loyalty-config";

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
 * Rupee value of a points balance (floored to whole rupees), the figure /loyalty
 * and the account dashboard show as wallet credit.
 *
 * This is what the balance is worth, not what an order can take: for that, use
 * {@link quoteLoyalty}, which applies the redemption limits.
 */
export function maxRedeemableRupees(
  points: number,
  pointsPerRupee: number = POINTS_PER_RUPEE,
): number {
  const ratio = pointsPerRupee > 0 ? pointsPerRupee : POINTS_PER_RUPEE;
  return Math.floor(points / ratio);
}

/** Why no points can come off this order, or null when some can. */
export type LoyaltyBlock =
  | "no-balance"
  | "below-minimum"
  | "order-too-small"
  | "coupon-covers-order"
  | "coupon-no-stack";

export interface LoyaltyQuote {
  /** Points the order would burn: the most the limits allow, not the balance. */
  points: number;
  /** What those points take off, in paise. */
  discountPaise: number;
  blocked: LoyaltyBlock | null;
}

export type LoyaltyRedeemRules = Pick<
  LoyaltyConfig,
  "redeemPointsPerRupee" | "minRedeemPoints" | "maxRedeemPercent"
>;

/**
 * What loyalty can take off this order, worked out the way the server will.
 *
 * Mirrors `quoteLoyaltyRedemption` in `lib/rewards.ts`, which is the authority:
 * same paise, same floors, same order of limits. Checkout used to work this out
 * in whole rupees, in two places. A ₹1 order floored its 20p limit to ₹0, so the
 * rewards switch stayed enabled but clicking it changed nothing, while the
 * server would have honoured the redemption. Everything checkout shows and sends
 * now comes from one call to this, so the panel, the totals and the order agree.
 *
 * `rewards.ts` is server-only, so the rate is restated here rather than imported;
 * `order-math.test.ts` runs both against the same cases to catch them drifting.
 */
export function quoteLoyalty(args: {
  balance: number;
  subtotalPaise: number;
  /** Discount the coupon has already taken: loyalty only gets what it left. */
  couponDiscountPaise: number;
  /**
   * The applied coupon doesn't stack. The create-order path redeems nothing with
   * one whatever is asked for, so the quote has to come to nothing too, or checkout
   * shows a total the customer won't be charged.
   */
  couponBlocksLoyalty?: boolean;
  config: LoyaltyRedeemRules;
}): LoyaltyQuote {
  const { balance, subtotalPaise, couponDiscountPaise, couponBlocksLoyalty, config } = args;
  const none = (blocked: LoyaltyBlock): LoyaltyQuote => ({
    points: 0,
    discountPaise: 0,
    blocked,
  });

  if (balance <= 0) return none("no-balance");
  if (balance < config.minRedeemPoints) return none("below-minimum");

  const subtotal = Math.max(0, Math.round(subtotalPaise));
  const reserved = Math.max(0, Math.round(couponDiscountPaise));
  const ratio =
    config.redeemPointsPerRupee > 0 ? config.redeemPointsPerRupee : POINTS_PER_RUPEE;
  const paisePerPoint = Math.max(1, Math.round(100 / ratio));
  const percentCapPaise = Math.floor((subtotal * config.maxRedeemPercent) / 100);
  const orderTooSmall = Math.floor(percentCapPaise / paisePerPoint) <= 0;
  // Only once the balance and the order would allow points. Blaming the coupon
  // otherwise sends the customer to remove it for nothing.
  if (couponBlocksLoyalty && !orderTooSmall) return none("coupon-no-stack");

  const capPaise = Math.min(percentCapPaise, Math.max(0, subtotal - reserved));

  const points = Math.min(balance, Math.floor(capPaise / paisePerPoint));
  if (points <= 0) {
    // Told apart because the customer can act on one of them: taking the coupon
    // off frees the order up, but nothing they can remove helps a tiny order.
    return none(orderTooSmall ? "order-too-small" : "coupon-covers-order");
  }
  return { points, discountPaise: points * paisePerPoint, blocked: null };
}

/** The plain sentence for a blocked redemption: a greyed-out switch alone reads as broken. */
export function loyaltyBlockMessage(
  block: LoyaltyBlock,
  balance: number,
  config: LoyaltyRedeemRules,
): string {
  switch (block) {
    case "no-balance":
      return "You don't have any points to redeem yet.";
    case "below-minimum":
      return `You need ${config.minRedeemPoints} points to redeem. You have ${balance}.`;
    case "order-too-small":
      return `This order is too small to use points on. Points can cover up to ${config.maxRedeemPercent}% of an order.`;
    case "coupon-covers-order":
      return "Your coupon already covers this order, so there's nothing left to use points on.";
    case "coupon-no-stack":
      return "This coupon can't be combined with points. Remove it to use them.";
  }
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

/**
 * Loyalty points an order will earn, on the same payable total and at the same
 * live rate as `earnPointsForOrder` in `lib/rewards.ts`. Used to be a flat "1
 * point per ₹10", which promised points the server would never credit.
 */
export function pointsEarned(
  totalPaise: number,
  config: Pick<LoyaltyConfig, "earnEnabled" | "earnPointsPerRupee">,
): number {
  if (!config.earnEnabled) return 0;
  return Math.floor((Math.max(0, Math.round(totalPaise)) * config.earnPointsPerRupee) / 100);
}

export const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Like {@link INR}, but keeps the paise when there are any. For checkout's money
 * lines, where a points discount can be ₹0.20: rounded, that reads as "− ₹0" off
 * a total that hasn't moved, which looks like the points did nothing.
 */
export const INRExact = (n: number) => {
  const paise = Math.round(n * 100);
  const digits = paise % 100 === 0 ? 0 : 2;
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};
