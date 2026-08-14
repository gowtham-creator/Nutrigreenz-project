import "server-only";
import { getPublicCommerceRules } from "./commerce-rules";

/**
 * The free-delivery threshold, in whole rupees, as configured by a Super Admin.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * The threshold has always been editable — it lives in `commerce_rules`, the
 * Super Admin edits it in Config, and the cart and checkout price against
 * whatever it currently says. The storefront's *copy* did not follow. "₹599"
 * was typed by hand into the assurance band, the shop trust band, the shop
 * hero chip, the shipping policy, the loyalty tiers and the address book.
 *
 * So raising the threshold to ₹799 would have changed what a shopper is
 * actually charged while every page continued to promise free delivery over
 * ₹599 — the site advertising one number and billing another. That is a
 * consumer-protection problem before it is a content problem, and it is the
 * kind that only shows up after someone changes the setting and assumes the
 * page is telling the truth.
 *
 * One read, one number, everywhere the claim is made.
 *
 * Falls back to 599 if the rules cannot be read, matching the column default
 * in the migration — a page that renders the old number is recoverable, a page
 * that fails to render is not.
 */
export async function freeDeliveryThreshold(): Promise<number> {
  const rules = await getPublicCommerceRules().catch(() => null);
  return Math.round((rules?.freeDeliveryThresholdPaise ?? 59900) / 100);
}

/** Pre-formatted for copy, e.g. "₹599". */
export async function freeDeliveryThresholdLabel(): Promise<string> {
  const value = await freeDeliveryThreshold();
  return `₹${value.toLocaleString("en-IN")}`;
}
