"use client";

/**
 * rewards-client — thin browser helpers over the customer rewards APIs.
 *
 * Backs the checkout coupon field and the Harvest-Coins wallet with the real
 * server-side engine (coupons + append-only loyalty ledger) instead of the
 * static demo data. Every call is best-effort and ownership-scoped server-side
 * via the `ng_session` cookie — a signed-out or unconfigured environment simply
 * yields an empty wallet / a soft failure, never a thrown error at the UI.
 */

export interface LoyaltyLedgerRow {
  id: string;
  orderId: string | null;
  deltaPoints: number;
  reason: string;
  createdAt: string;
}

export interface RewardsSummary {
  balance: number;
  ledger: LoyaltyLedgerRow[];
}

/** The signed-in customer's live points balance + recent ledger (empty when out). */
export async function fetchRewards(): Promise<RewardsSummary> {
  try {
    const res = await fetch("/api/account/rewards", { cache: "no-store" });
    if (!res.ok) return { balance: 0, ledger: [] };
    const json = (await res.json()) as {
      ok?: boolean;
      balance?: number;
      ledger?: Array<{
        id?: string;
        orderId?: string | null;
        deltaPoints?: number;
        reason?: string;
        createdAt?: string;
      }>;
    };
    return {
      balance: Math.max(0, Math.round(json.balance ?? 0)),
      ledger: (json.ledger ?? []).map((r) => ({
        id: r.id ?? "",
        orderId: r.orderId ?? null,
        deltaPoints: Math.round(r.deltaPoints ?? 0),
        reason: r.reason ?? "",
        createdAt: r.createdAt ?? "",
      })),
    };
  } catch {
    return { balance: 0, ledger: [] };
  }
}

export type CouponQuoteReason =
  | "ok"
  | "not-found"
  | "inactive"
  | "expired"
  | "not-started"
  | "below-min"
  | "usage-limit"
  | "customer-limit"
  | "phone-verification-required"
  | "area-not-eligible"
  | "unavailable";

export interface CouponQuote {
  valid: boolean;
  /** Discount in paise (integer). */
  discountPaise: number;
  reason: CouponQuoteReason;
  code: string | null;
}

const COUPON_REASON_COPY: Record<string, string> = {
  "not-found": "That code isn't valid.",
  inactive: "This coupon is no longer active.",
  expired: "This coupon has expired.",
  "not-started": "This coupon isn't active yet.",
  "below-min": "Your cart doesn't meet this coupon's minimum.",
  "usage-limit": "This coupon has reached its usage limit.",
  "customer-limit": "You've already used this coupon.",
  "phone-verification-required":
    "Verify your mobile number to use this welcome offer. We'll ask for a quick OTP.",
  "area-not-eligible": "This code isn't available for your delivery address.",
  unavailable: "Coupons are unavailable right now. Please try again.",
  unauthenticated: "Please sign in to apply a coupon.",
};

/** Human-readable message for a non-`ok` coupon reason. */
export function couponReasonMessage(reason: string): string {
  return COUPON_REASON_COPY[reason] ?? "That code can't be applied.";
}

/**
 * Server-validated coupon quote for the given cart subtotal (paise).
 * Returns `{ valid:false, reason }` for any gate failure — including a 401
 * (mapped to `unavailable`) so a signed-out shopper gets a clear prompt.
 */
export async function validateCouponApi(
  code: string,
  subtotalPaise: number,
  /** Delivery pincode — required for coupons targeted at specific areas. */
  pincode?: string | null,
  /**
   * Product ids in the cart — required for product-targeted coupons, which
   * reject rather than fall through when the cart context is missing.
   */
  productIds?: readonly (string | null | undefined)[],
): Promise<CouponQuote> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, discountPaise: 0, reason: "not-found", code: null };
  try {
    const res = await fetch("/api/rewards/validate-coupon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: trimmed,
        subtotalPaise: Math.max(0, Math.round(subtotalPaise)),
        pincode: pincode?.trim() || null,
        productIds: (productIds ?? []).filter(Boolean),
      }),
    });
    if (res.status === 401) {
      return { valid: false, discountPaise: 0, reason: "unavailable", code: null };
    }
    if (!res.ok) {
      return { valid: false, discountPaise: 0, reason: "unavailable", code: null };
    }
    const json = (await res.json()) as {
      valid?: boolean;
      discountPaise?: number;
      reason?: CouponQuoteReason;
      coupon?: { code?: string } | null;
    };
    return {
      valid: Boolean(json.valid),
      discountPaise: Math.max(0, Math.round(json.discountPaise ?? 0)),
      reason: json.reason ?? (json.valid ? "ok" : "not-found"),
      code: json.coupon?.code ?? (json.valid ? trimmed.toUpperCase() : null),
    };
  } catch {
    return { valid: false, discountPaise: 0, reason: "unavailable", code: null };
  }
}
