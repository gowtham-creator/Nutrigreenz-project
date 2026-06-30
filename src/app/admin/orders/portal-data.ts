/**
 * Client-side types + helpers for the admin Orders Portal (Phase C 2/2).
 *
 * These mirror the server records returned by `GET /api/admin/orders` and
 * `GET /api/admin/orders/[id]` (see `src/lib/orders.ts`). The portal is a thin,
 * read-mostly client over those admin-gated APIs: the only mutation is the
 * forward-only status advance (`POST /api/admin/orders/[id]/status`). There is
 * deliberately NO cancel/refund path here (§3.9 no-cancellation).
 */
import type { Pill } from "@/components/ng/admin/admin-shell";
import type { ComponentProps } from "react";

/* ── status model (must match src/lib/orders.ts) ──────────────────────── */

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered";

export type PaymentStatus = "pending" | "paid" | "failed";

/** Forward-only fulfilment pipeline; index is the rank. */
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

/** Human label for each fulfilment stage. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

/** Label for the action that advances INTO each stage. */
export const ADVANCE_LABEL: Record<OrderStatus, string> = {
  placed: "Reopen", // never used (placed is the first stage)
  confirmed: "Confirm order",
  packed: "Mark packed",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
};

type PillTone = NonNullable<ComponentProps<typeof Pill>["tone"]>;

/** Pill tone for each fulfilment status (matches the admin-shell `Pill`). */
export const STATUS_TONE: Record<OrderStatus, PillTone> = {
  placed: "warn",
  confirmed: "info",
  packed: "info",
  shipped: "info",
  delivered: "success",
};

/** Pill tone for each payment status. */
export const PAYMENT_TONE: Record<PaymentStatus, PillTone> = {
  pending: "warn",
  paid: "success",
  failed: "danger",
};

/** Rank of a status within the forward-only flow (-1 when unknown). */
export function statusRank(status: string): number {
  return ORDER_STATUS_FLOW.indexOf(status as OrderStatus);
}

/** The single next forward stage, or null when already delivered. */
export function nextStatus(current: OrderStatus): OrderStatus | null {
  const rank = statusRank(current);
  if (rank < 0 || rank >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[rank + 1];
}

/* ── record shapes (camelCased view from the API) ─────────────────────── */

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  variantSku: string | null;
  title: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  snapshot: Record<string, unknown> | null;
}

export interface OrderStatusEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  at: string;
  by: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: string;
  paymentRef: string | null;
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
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderStatusEvent[];
}

/* ── formatting ───────────────────────────────────────────────────────── */

/** Format integer paise to a "₹89.00" rupee string. */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Total item count across an order's lines. */
export function itemCount(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, it) => sum + it.qty, 0);
}

/** Best-effort customer display name from the order's contact snapshot. */
export function customerLabel(order: Order): string {
  const fromAddress = readSnapshotString(order.addressSnapshot, [
    "name",
    "fullName",
    "recipient",
    "contactName",
  ]);
  if (fromAddress) return fromAddress;
  if (order.userEmail) return order.userEmail;
  if (order.userPhone) return order.userPhone;
  return "Guest";
}

/** A short secondary contact line (email · phone), de-duplicated. */
export function customerContact(order: Order): string {
  return [order.userEmail, order.userPhone].filter(Boolean).join(" · ");
}

/** Absolute, human-readable timestamp in IST. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact relative age, e.g. "3h ago" / "2d ago". */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/* ── snapshot helpers (snapshots are free-form JSON) ──────────────────── */

/** Read the first present, non-empty string value from a snapshot object. */
export function readSnapshotString(
  snapshot: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!snapshot) return null;
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

/** Flatten a snapshot object into label/value rows for display. */
export function snapshotRows(
  snapshot: Record<string, unknown> | null,
): { label: string; value: string }[] {
  if (!snapshot) return [];
  const rows: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(snapshot)) {
    if (raw === null || raw === undefined || raw === "") continue;
    let value: string;
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      value = String(raw);
    } else {
      try {
        value = JSON.stringify(raw);
      } catch {
        continue;
      }
    }
    rows.push({ label: humanizeKey(key), value });
  }
  return rows;
}

/** "addressLine1" → "Address line 1". */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
