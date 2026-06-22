/**
 * Lightweight order "receipt" handed from the checkout page to the confirmation
 * page via sessionStorage (no backend yet). Keyed by order id so a refresh or a
 * shared link still renders something sensible.
 */

import type { Address, CartItem } from "@/types/nutrigreenz";
import type { PaymentSelection } from "./payment-picker";

export interface OrderReceipt {
  id: string;
  placedAt: string;
  items: CartItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  loyaltyPoints: number;
  loyaltyDiscount: number;
  shipping: number;
  total: number;
  taxInclusive: boolean;
  payment: PaymentSelection;
  slotLabel: string;
  address: Address | null;
  pointsToEarn: number;
}

const PREFIX = "ng.order.";

export function saveReceipt(receipt: OrderReceipt): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + receipt.id, JSON.stringify(receipt));
  } catch {
    /* private mode / quota — confirmation page will fall back to a stub */
  }
}

export function loadReceipt(id: string): OrderReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as OrderReceipt;
  } catch {
    return null;
  }
}

/** All order receipts saved in this session, newest first. */
export function listReceipts(): OrderReceipt[] {
  if (typeof window === "undefined") return [];
  const out: OrderReceipt[] = [];
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const r = loadReceipt(key.slice(PREFIX.length));
      if (r) out.push(r);
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => (a.placedAt > b.placedAt ? -1 : 1));
}
