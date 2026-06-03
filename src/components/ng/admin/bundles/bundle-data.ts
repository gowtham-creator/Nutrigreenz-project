/**
 * Community-bundle grouping logic (Admin Orders Portal · scope §3.11).
 *
 * Groups CONFIRMED orders by gated-community + delivery date and computes
 * consolidated SKU totals for each group. This is purely informational /
 * operational — the client decides individual vs bundled packing. There is
 * NO auto re-pricing or merging here: every order keeps its own id, value
 * and status; the bundle total is a plain sum, the SKU totals a plain count.
 */

import { ADMIN_ORDERS, itemCount } from "@/components/ng/admin/orders-data";
import type { AdminOrder, OrderStatus } from "@/components/ng/admin/orders-data";

/** Statuses that are NOT confirmed and are excluded from bundling. */
const UNCONFIRMED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "Awaiting payment",
  "Payment failed",
]);

export function isConfirmed(o: AdminOrder): boolean {
  return !UNCONFIRMED.has(o.status);
}

/** One consolidated SKU line across all orders in a bundle group. */
export interface ConsolidatedSku {
  sku: string;
  title: string;
  unit: string;
  /** Total quantity of this SKU/unit across every order in the group. */
  qty: number;
}

/** A community + delivery-date bundle of confirmed orders. */
export interface BundleGroup {
  key: string;
  community: string;
  area: string;
  pincode: string;
  city: string;
  deliveryDate: string;
  /** Distinct delivery slots represented in the group (usually one). */
  slots: string[];
  orders: AdminOrder[];
  /** Aggregated SKU quantities for packing consolidation. */
  consolidated: ConsolidatedSku[];
  /** Plain sum of order totals — NOT a re-price. */
  bundleTotal: number;
  /** Sum of item counts across orders. */
  totalItems: number;
}

/**
 * Build bundle groups from the shared dataset. Confirmed orders only.
 * Groups are sorted by soonest delivery date first, then community name.
 */
export function buildBundleGroups(orders: AdminOrder[] = ADMIN_ORDERS): BundleGroup[] {
  const map = new Map<string, BundleGroup>();

  for (const o of orders) {
    if (!isConfirmed(o)) continue;

    const key = `${o.address.community}__${o.deliveryDate}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        community: o.address.community,
        area: o.address.area,
        pincode: o.address.pincode,
        city: o.address.city,
        deliveryDate: o.deliveryDate,
        slots: [],
        orders: [],
        consolidated: [],
        bundleTotal: 0,
        totalItems: 0,
      };
      map.set(key, group);
    }

    group.orders.push(o);
    group.bundleTotal += o.total;
    group.totalItems += itemCount(o);
    if (!group.slots.includes(o.slot)) group.slots.push(o.slot);
  }

  // Compute consolidated SKU totals per group (qty summed by sku+unit).
  for (const group of map.values()) {
    const skuMap = new Map<string, ConsolidatedSku>();
    for (const o of group.orders) {
      for (const it of o.items) {
        const skuKey = `${it.sku}__${it.unit}`;
        const line = skuMap.get(skuKey);
        if (line) {
          line.qty += it.qty;
        } else {
          skuMap.set(skuKey, { sku: it.sku, title: it.title, unit: it.unit, qty: it.qty });
        }
      }
    }
    group.consolidated = Array.from(skuMap.values()).sort((a, b) =>
      b.qty - a.qty || a.title.localeCompare(b.title),
    );
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      a.deliveryDate.localeCompare(b.deliveryDate) || a.community.localeCompare(b.community),
  );
}

/** Distinct delivery dates (sorted ascending) across the built groups. */
export function bundleDeliveryDates(groups: BundleGroup[]): string[] {
  return Array.from(new Set(groups.map((g) => g.deliveryDate))).sort();
}

/** Friendly date label, e.g. "Thu 4 Jun". Date-only, no timezone surprises. */
export function formatDeliveryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
