/**
 * The Orders portal's period summary: today, this week and this month.
 *
 * One read of the orders placed since the start of LAST month answers all three
 * periods and their comparisons, so the portal makes one request however the
 * operator flips between them. Periods are IST calendar periods (the business,
 * its customers and its operators are all in India), weeks start on Monday, and
 * the comparison is always "to date": today so far against yesterday up to the
 * same time, never a part day against a whole one.
 *
 * Money follows the reports page: an order's value counts as booked unless it
 * was cancelled; collected is the booked value already paid.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listDeliverySlots } from "@/lib/commerce-rules";
import type { OrderStatus } from "@/lib/orders";
import { istDay, periodWindows, SUMMARY_PERIODS, type PeriodWindow, type SummaryPeriod } from "@/lib/order-periods";

export { periodWindows, type PeriodWindow, type SummaryPeriod } from "@/lib/order-periods";

/* ── shapes ───────────────────────────────────────────────────────────── */

export interface SummaryFigures {
  /** Every order placed, cancelled ones included. */
  orders: number;
  cancelled: number;
  delivered: number;
  /** Value of the orders that were not cancelled. */
  bookedPaise: number;
  /** Of the booked value, what has been paid. */
  collectedPaise: number;
  /** Not cancelled and not yet paid: what is still to be collected. */
  paymentPending: number;
}

export interface SlotCount {
  /** The slot's id when it is one of the configured slots, otherwise null. */
  id: string | null;
  label: string;
  orders: number;
}

export interface PeriodSummary extends SummaryFigures {
  key: SummaryPeriod;
  from: string;
  to: string;
  avgOrderPaise: number;
  byStatus: Record<OrderStatus, number>;
  /** Orders and booked value per IST day, first day through today. */
  daily: { day: string; orders: number; bookedPaise: number }[];
  /** Orders per delivery slot chosen at checkout, busiest first. */
  slots: SlotCount[];
  /** The previous period up to the same point in it. */
  previous: SummaryFigures;
}

export interface SlotStatus {
  id: string;
  label: string;
  windowText: string | null;
  sort: number;
  active: boolean;
  /** Orders placed today that chose this slot. */
  todayOrders: number;
}

export interface OrderSummary {
  generatedAt: string;
  periods: Record<SummaryPeriod, PeriodSummary>;
  /** All-time work still open, whatever the period being looked at. */
  open: { placed: number; confirmed: number; packed: number; shipped: number; paymentPending: number };
  slots: SlotStatus[];
}

/* ── aggregation ──────────────────────────────────────────────────────── */

export interface SummaryOrderRow {
  status: string;
  payment_status: string;
  total_paise: number;
  placed_at: string;
  slot_snapshot: Record<string, unknown> | null;
}

const STATUSES: readonly OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"];

function emptyFigures(): SummaryFigures {
  return { orders: 0, cancelled: 0, delivered: 0, bookedPaise: 0, collectedPaise: 0, paymentPending: 0 };
}

function addTo(f: SummaryFigures, o: SummaryOrderRow): void {
  f.orders += 1;
  if (o.status === "cancelled") {
    f.cancelled += 1;
    return;
  }
  if (o.status === "delivered") f.delivered += 1;
  f.bookedPaise += o.total_paise;
  if (o.payment_status === "paid") f.collectedPaise += o.total_paise;
  else if (o.payment_status === "pending") f.paymentPending += 1;
}

/**
 * Which slot an order chose. Snapshots written before slots were checked at the
 * server carry whatever the browser sent, so an id that is no longer configured
 * is grouped by its label instead of being dropped.
 */
function slotKey(
  snapshot: Record<string, unknown> | null,
  known: Map<string, string>,
): { id: string | null; label: string } {
  const id = typeof snapshot?.id === "string" ? snapshot.id : null;
  if (id && known.has(id)) return { id, label: known.get(id)! };
  const label = typeof snapshot?.label === "string" && snapshot.label.trim() ? snapshot.label.trim() : null;
  return { id: null, label: label ?? "No slot chosen" };
}

/**
 * Fold the rows into the three period summaries. Pure: `rows` must cover
 * everything from the start of last month, which is the earliest boundary any
 * of the three periods or their comparisons reach.
 */
export function summarisePeriods(
  rows: SummaryOrderRow[],
  windows: Record<SummaryPeriod, PeriodWindow>,
  now: Date,
  slotLabels: Map<string, string> = new Map(),
): Record<SummaryPeriod, PeriodSummary> {
  const nowMs = now.getTime();
  const out = {} as Record<SummaryPeriod, PeriodSummary>;

  for (const key of SUMMARY_PERIODS) {
    const w = windows[key];
    const from = Date.parse(w.from);
    const to = Date.parse(w.to);
    const prevFrom = Date.parse(w.previousFrom);
    // "To date": as far into the previous period as we are into this one.
    const prevCut = Math.min(Date.parse(w.previousTo), prevFrom + (nowMs - from));

    const current = emptyFigures();
    const previous = emptyFigures();
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
    const daily = new Map(w.days.map((day) => [day, { day, orders: 0, bookedPaise: 0 }]));
    const slots = new Map<string, SlotCount>();

    for (const o of rows) {
      const t = Date.parse(o.placed_at);
      if (!Number.isFinite(t)) continue;
      if (t >= prevFrom && t < prevCut) addTo(previous, o);
      if (t < from || t >= to) continue;

      addTo(current, o);
      if (STATUSES.includes(o.status as OrderStatus)) byStatus[o.status as OrderStatus] += 1;

      const d = daily.get(istDay(t));
      if (d) {
        d.orders += 1;
        if (o.status !== "cancelled") d.bookedPaise += o.total_paise;
      }

      const slot = slotKey(o.slot_snapshot, slotLabels);
      const k = slot.id ?? `label:${slot.label}`;
      const entry = slots.get(k) ?? { ...slot, orders: 0 };
      entry.orders += 1;
      slots.set(k, entry);
    }

    const kept = current.orders - current.cancelled;
    out[key] = {
      key,
      from: w.from,
      to: w.to,
      ...current,
      avgOrderPaise: kept > 0 ? Math.round(current.bookedPaise / kept) : 0,
      byStatus,
      daily: [...daily.values()],
      slots: [...slots.values()].sort((a, b) => b.orders - a.orders || a.label.localeCompare(b.label)),
      previous,
    };
  }
  return out;
}

/* ── database ─────────────────────────────────────────────────────────── */

const PAGE = 1000;
// 50 pages is 50,000 orders in two months: far beyond the business today, and
// a bound that stops a runaway loop rather than one that is ever expected to bite.
const MAX_PAGES = 50;

async function ordersSince(fromIso: string): Promise<SummaryOrderRow[]> {
  const db = supabaseAdmin();
  const rows: SummaryOrderRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db
      .from("orders")
      .select("status, payment_status, total_paise, placed_at, slot_snapshot")
      .gte("placed_at", fromIso)
      .order("placed_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data as SummaryOrderRow[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function countOrders(filter: { status?: OrderStatus; paymentPending?: boolean }): Promise<number> {
  let q = supabaseAdmin().from("orders").select("id", { count: "exact", head: true });
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.paymentPending) q = q.eq("payment_status", "pending").neq("status", "cancelled");
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** The whole Orders-portal summary: three periods, the open backlog, and slots. */
export async function buildOrderSummary(now: Date = new Date()): Promise<OrderSummary> {
  const windows = periodWindows(now);
  const [rows, slots, placed, confirmed, packed, shipped, paymentPending] = await Promise.all([
    ordersSince(windows.month.previousFrom),
    listDeliverySlots(),
    countOrders({ status: "placed" }),
    countOrders({ status: "confirmed" }),
    countOrders({ status: "packed" }),
    countOrders({ status: "shipped" }),
    countOrders({ paymentPending: true }),
  ]);

  const labels = new Map(slots.map((s) => [s.id, s.label]));
  const periods = summarisePeriods(rows, windows, now, labels);
  const todayBySlot = new Map(periods.today.slots.map((s) => [s.id, s.orders]));

  return {
    generatedAt: now.toISOString(),
    periods,
    open: { placed, confirmed, packed, shipped, paymentPending },
    slots: slots.map((s) => ({
      id: s.id,
      label: s.label,
      windowText: s.windowText,
      sort: s.sort,
      active: s.active,
      todayOrders: todayBySlot.get(s.id) ?? 0,
    })),
  };
}
