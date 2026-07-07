/**
 * Community-bundle aggregation (Supabase `public.orders` + `public.order_items`).
 * Powers `GET /api/admin/orders/bundles`, replacing the mock bundle dataset in
 * `src/components/ng/admin/bundles/bundle-data.ts`.
 *
 * Groups the REAL pre-dispatch orders (placed / confirmed / packed, payment not
 * failed — the set an operator still has to pack for a delivery run) by gated
 * community + pincode (parsed from `address_snapshot`) and delivery date (parsed
 * from `slot_snapshot`), then consolidates SKU quantities across each group for
 * packing. This is purely informational: every order keeps its own id, value and
 * status — there is NO re-pricing or merging; the bundle total is a plain sum.
 *
 * Service-role only — import from Node route handlers, never client/Edge. Money
 * is integer paise (₹1 = 100 paise).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ORDER_STATUS_FLOW, type OrderStatus } from "@/lib/orders";

/* ── result shapes ────────────────────────────────────────────────────── */

/** One order's summary line inside a bundle group. */
export interface BundleOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: OrderStatus;
  totalPaise: number;
  itemCount: number;
}

/** A SKU line consolidated across every order in a group (for packing). */
export interface BundleConsolidatedItem {
  key: string;
  title: string;
  sku: string | null;
  unit: string | null;
  qty: number;
}

/** A gated-community + delivery-date bundle of pre-dispatch orders. */
export interface BundleGroup {
  key: string;
  community: string;
  area: string | null;
  pincode: string | null;
  city: string | null;
  deliveryDate: string | null;
  /** Distinct delivery-slot labels represented in the group. */
  slotLabels: string[];
  orderCount: number;
  totalItems: number;
  /** Plain sum of order totals — NOT a re-price. Integer paise. */
  bundleTotalPaise: number;
  orders: BundleOrderSummary[];
  consolidated: BundleConsolidatedItem[];
}

export interface BundlesResult {
  groups: BundleGroup[];
  /** Distinct delivery dates across the built groups (ascending, nulls last). */
  deliveryDates: string[];
  totals: {
    groups: number;
    orders: number;
    bundleTotalPaise: number;
  };
}

/** Pre-dispatch statuses that still need bundling for a delivery run. */
const BUNDLEABLE_STATUSES: readonly OrderStatus[] = ["placed", "confirmed", "packed"];

interface BundleOrderRow {
  id: string;
  order_number: string;
  user_email: string | null;
  status: string;
  payment_status: string;
  total_paise: number;
  address_snapshot: Record<string, unknown> | null;
  slot_snapshot: Record<string, unknown> | null;
}

interface BundleItemRow {
  order_id: string;
  variant_sku: string | null;
  title: string;
  qty: number;
  snapshot: Record<string, unknown> | null;
}

/* ── snapshot parsing (defensive — snapshots are free-form jsonb) ─────── */

/** First non-empty string value among the given keys of a jsonb record. */
function pick(rec: Record<string, unknown> | null, keys: string[]): string | null {
  if (!rec) return null;
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Delivery date from a slot snapshot; a full ISO timestamp is trimmed to a day. */
function deliveryDateFrom(slot: Record<string, unknown> | null): string | null {
  const raw = pick(slot, ["date", "deliveryDate", "slotDate", "day"]);
  if (!raw) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return iso ? iso[1] : raw;
}

function toStatus(raw: string): OrderStatus {
  return ORDER_STATUS_FLOW.includes(raw as OrderStatus) ? (raw as OrderStatus) : "placed";
}

/* ── aggregation ──────────────────────────────────────────────────────── */

/**
 * Build the community bundle groups from real pre-dispatch orders. Groups are
 * sorted by soonest delivery date first (undated last), then community name.
 */
export async function buildOrderBundles(): Promise<BundlesResult> {
  const db = supabaseAdmin();

  const { data: orderData } = await db
    .from("orders")
    .select(
      "id, order_number, user_email, status, payment_status, total_paise, address_snapshot, slot_snapshot",
    )
    .in("status", [...BUNDLEABLE_STATUSES])
    .neq("payment_status", "failed")
    .order("placed_at", { ascending: true });
  const orders = (orderData as BundleOrderRow[] | null) ?? [];

  if (orders.length === 0) {
    return { groups: [], deliveryDates: [], totals: { groups: 0, orders: 0, bundleTotalPaise: 0 } };
  }

  // Line items for those orders, indexed by order id.
  const orderIds = orders.map((o) => o.id);
  const itemsByOrder = new Map<string, BundleItemRow[]>();
  const { data: itemData } = await db
    .from("order_items")
    .select("order_id, variant_sku, title, qty, snapshot")
    .in("order_id", orderIds);
  for (const it of (itemData as BundleItemRow[] | null) ?? []) {
    const list = itemsByOrder.get(it.order_id) ?? [];
    list.push(it);
    itemsByOrder.set(it.order_id, list);
  }

  const groups = new Map<string, BundleGroup>();

  for (const o of orders) {
    const addr = o.address_snapshot;
    const slot = o.slot_snapshot;
    const pincode = pick(addr, ["pincode"]);
    const community =
      pick(addr, ["community", "area", "areaLandmark", "landmark"]) ??
      (pincode ? `Pincode ${pincode}` : "Unassigned");
    const area = pick(addr, ["area", "areaLandmark", "landmark", "roadStreet", "line2"]);
    const city = pick(addr, ["city"]);
    const deliveryDate = deliveryDateFrom(slot);
    const slotLabel = pick(slot, ["label", "windowText", "name"]);
    const customerName = pick(addr, ["fullName", "name"]) ?? o.user_email;

    const key = `${pincode ?? "na"}__${community}__${deliveryDate ?? "na"}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        community,
        area,
        pincode,
        city,
        deliveryDate,
        slotLabels: [],
        orderCount: 0,
        totalItems: 0,
        bundleTotalPaise: 0,
        orders: [],
        consolidated: [],
      };
      groups.set(key, group);
    }

    const items = itemsByOrder.get(o.id) ?? [];
    const itemCount = items.reduce((n, it) => n + it.qty, 0);

    group.orders.push({
      id: o.id,
      orderNumber: o.order_number,
      customerName,
      status: toStatus(o.status),
      totalPaise: o.total_paise,
      itemCount,
    });
    group.orderCount += 1;
    group.totalItems += itemCount;
    group.bundleTotalPaise += o.total_paise;
    if (slotLabel && !group.slotLabels.includes(slotLabel)) group.slotLabels.push(slotLabel);
  }

  // Consolidate SKU quantities per group (summed by sku+unit, else title+unit).
  for (const group of groups.values()) {
    const skuMap = new Map<string, BundleConsolidatedItem>();
    for (const order of group.orders) {
      for (const it of itemsByOrder.get(order.id) ?? []) {
        const unit = pick(it.snapshot, ["unit", "variantLabel"]);
        const skuKey = `${it.variant_sku ?? it.title}__${unit ?? ""}`;
        const line = skuMap.get(skuKey);
        if (line) {
          line.qty += it.qty;
        } else {
          skuMap.set(skuKey, {
            key: skuKey,
            title: it.title,
            sku: it.variant_sku,
            unit,
            qty: it.qty,
          });
        }
      }
    }
    group.consolidated = Array.from(skuMap.values()).sort(
      (a, b) => b.qty - a.qty || a.title.localeCompare(b.title),
    );
  }

  // Soonest delivery date first; undated groups sink to the bottom.
  const sorted = Array.from(groups.values()).sort((a, b) => {
    if (a.deliveryDate !== b.deliveryDate) {
      if (a.deliveryDate === null) return 1;
      if (b.deliveryDate === null) return -1;
      const byDate = a.deliveryDate.localeCompare(b.deliveryDate);
      if (byDate !== 0) return byDate;
    }
    return a.community.localeCompare(b.community);
  });

  const deliveryDates = Array.from(
    new Set(sorted.map((g) => g.deliveryDate).filter((d): d is string => d !== null)),
  ).sort();

  const totalOrders = sorted.reduce((n, g) => n + g.orderCount, 0);
  const totalValue = sorted.reduce((n, g) => n + g.bundleTotalPaise, 0);

  return {
    groups: sorted,
    deliveryDates,
    totals: { groups: sorted.length, orders: totalOrders, bundleTotalPaise: totalValue },
  };
}
