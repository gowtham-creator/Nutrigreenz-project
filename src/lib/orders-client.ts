/**
 * Client-side helpers for the customer order-history UI (`/account/orders`).
 *
 * These talk to the cookie-authenticated order APIs (`GET /api/orders`,
 * `GET /api/orders/[number]`) and re-shape the server's paise-denominated
 * records for display. No money math is trusted to the client — the values
 * shown here are exactly what the server persisted.
 */

/** Customer-facing fulfilment lifecycle (mirrors the server, forward-only). */
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered";

export type PaymentStatus = "pending" | "paid" | "failed";

/** How the order is paid: 'upi' (online, via the gateway) or 'cod'. */
export type PaymentMethod = "upi" | "cod";

export interface OrderItemView {
  id: string;
  productId: string | null;
  variantId: string | null;
  variantSku: string | null;
  title: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  snapshot: Record<string, unknown> | null;
}

export interface OrderStatusEventView {
  id: string;
  status: OrderStatus;
  note: string | null;
  at: string;
  by: string;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /**
   * Decides what `paymentStatus: "pending"` means: normal for Cash on Delivery,
   * "not yet confirmed by the bank" for an online order.
   */
  paymentMethod: PaymentMethod;
  paymentProvider: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  couponCode: string | null;
  loyaltyRedeemedPaise: number;
  currency: string;
  addressSnapshot: Record<string, unknown> | null;
  slotSnapshot: Record<string, unknown> | null;
  placedAt: string;
  items: OrderItemView[];
  events: OrderStatusEventView[];
}

/** Fetch the signed-in customer's own orders (newest first). */
export async function fetchMyOrders(signal?: AbortSignal): Promise<OrderView[]> {
  const res = await fetch("/api/orders", {
    headers: { accept: "application/json" },
    signal,
  });
  if (res.status === 401) throw new OrdersAuthError();
  if (!res.ok) throw new Error("orders-fetch-failed");
  const data = (await res.json()) as { ok?: boolean; orders?: OrderView[] };
  return Array.isArray(data.orders) ? data.orders : [];
}

/** Fetch one of the customer's own orders by its NG-YY-XXXX number. */
export async function fetchMyOrder(
  orderNumber: string,
  signal?: AbortSignal,
): Promise<OrderView | null> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
    headers: { accept: "application/json" },
    signal,
  });
  if (res.status === 401) throw new OrdersAuthError();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("order-fetch-failed");
  const data = (await res.json()) as { ok?: boolean; order?: OrderView };
  return data.order ?? null;
}

/** Thrown when the API answers 401 — the caller should prompt re-auth. */
export class OrdersAuthError extends Error {
  constructor() {
    super("unauthenticated");
    this.name = "OrdersAuthError";
  }
}

/* ── display helpers ──────────────────────────────────────────────────── */

/** Format integer paise as a localized rupee string, e.g. 129900 → "₹1,299". */
export function inrFromPaise(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** Total units across all lines of an order. */
export function orderItemCount(order: OrderView): number {
  return order.items.reduce((sum, i) => sum + i.qty, 0);
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function statusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status] ?? "Order placed";
}

/** Soft tint + dot classes for a fulfilment status pill (matches storefront). */
export function statusTone(status: OrderStatus): { dot: string; pill: string } {
  switch (status) {
    case "delivered":
      return { dot: "bg-ng-green-bright", pill: "bg-ng-leaf/15 text-ng-forest" };
    case "shipped":
      return { dot: "bg-ng-amber", pill: "bg-ng-amber/15 text-ng-clay-deep" };
    case "packed":
    case "confirmed":
      return { dot: "bg-ng-blue", pill: "bg-ng-blue/12 text-ng-blue" };
    case "placed":
    default:
      return { dot: "bg-ng-forest", pill: "bg-ng-sage/50 text-ng-forest" };
  }
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
};

export function paymentLabel(status: PaymentStatus): string {
  return PAYMENT_LABEL[status] ?? "Payment pending";
}

/** Soft tint for a payment-status pill. */
export function paymentTone(status: PaymentStatus): { dot: string; pill: string } {
  switch (status) {
    case "paid":
      return { dot: "bg-ng-green-bright", pill: "bg-ng-leaf/15 text-ng-forest" };
    case "failed":
      return { dot: "bg-ng-danger", pill: "bg-ng-danger/12 text-ng-danger" };
    case "pending":
    default:
      return { dot: "bg-ng-amber", pill: "bg-ng-amber/15 text-ng-clay-deep" };
  }
}

/** Title list for the line summary (e.g. on the order card). */
export function orderProductTitles(order: OrderView): string[] {
  return order.items.map((i) => i.title);
}

/** Format an ISO timestamp as a friendly date, e.g. "30 June 2026". */
export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Format an ISO timestamp as date + time, e.g. "30 Jun, 8:42 PM". */
export function formatOrderDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** Pull a string field from a JSON snapshot (address/slot), tolerantly. */
export function snapshotString(
  snapshot: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!snapshot) return null;
  const v = snapshot[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
