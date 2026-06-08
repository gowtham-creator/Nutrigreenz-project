import type { Coupon } from "@/types/nutrigreenz";
import type { PaymentSelection } from "./payment-picker";

/**
 * checkout-draft — persists the customer's IN-PROGRESS checkout selections
 * (chosen address, delivery slot, payment method, coupon, loyalty toggle) to
 * localStorage so that if they leave before paying and come back later on the
 * same device, the checkout is restored exactly where they left off.
 *
 * Scope note (front-end / Milestone 1): this is a *customer-side* resume only —
 * the data lives in the shopper's own browser. Surfacing abandoned checkouts to
 * the admin/business (to follow up or send recovery emails) needs a server to
 * receive and store each session; that arrives with the Milestone 2 backend.
 */

const KEY = "ng.checkout.draft.v1";

export interface CheckoutDraft {
  addressId?: string | null;
  slotId?: string | null;
  payment?: PaymentSelection | null;
  applied?: { coupon: Coupon; discount: number } | null;
  redeemLoyalty?: boolean;
  acknowledged?: boolean;
  savedAt?: string;
}

export function readCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as CheckoutDraft) : null;
  } catch {
    return null;
  }
}

export function writeCheckoutDraft(draft: CheckoutDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch {
    /* quota / private-mode — fail silently */
  }
}

export function clearCheckoutDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
