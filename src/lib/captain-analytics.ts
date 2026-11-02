/**
 * Captain sales analytics: today, this week, month and quarter, plus any date
 * range, for one captain or everyone, overall or for one community.
 *
 * One read answers every figure on the screen, so flipping between them costs no
 * request. All periods are IST calendar periods and weeks start on Monday, the
 * same as the Orders portal; quarters are calendar quarters. A stall sale is a
 * separate channel from storefront orders and is never mixed with them.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listCaptains } from "@/lib/captains";
import { istDay, periodWindows } from "@/lib/order-periods";

export type AnalyticsPeriod = "today" | "week" | "month" | "quarter";
export const ANALYTICS_PERIODS: readonly AnalyticsPeriod[] = ["today", "week", "month", "quarter"];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Enough to find a sale by date; the figures above it still count everything. */
const SALES_SHOWN = 300;
const PAGE = 1000;
const MAX_PAGES = 50;

export interface SalesFigures {
  sales: number;
  gmvPaise: number;
  cashPaise: number;
  upiPaise: number;
}

/** A period's figures and the IST days it covers, inclusive. */
export interface PeriodFigures extends SalesFigures {
  from: string;
  to: string;
}

export interface SaleLine {
  id: string;
  captainId: string;
  captainName: string;
  customerName: string;
  customerMobile: string;
  community: string | null;
  items: string;
  totalPaise: number;
  payMode: "cash" | "upi";
  capturedAt: string;
}

export interface CaptainAnalytics {
  periods: Record<AnalyticsPeriod, PeriodFigures>;
  range: PeriodFigures & { daily: { day: string; sales: number; gmvPaise: number }[] };
  byCaptain: { captainId: string; name: string; sales: number; gmvPaise: number }[];
  byCommunity: { community: string; sales: number; gmvPaise: number }[];
  /** Every community to filter by, whether or not it sold in this range. */
  communities: string[];
  sales: SaleLine[];
}

export interface CaptureRow {
  id: string;
  captain_id: string;
  customer_name: string;
  customer_mobile: string;
  community: string | null;
  items: unknown;
  total_paise: number;
  pay_mode: string;
  captured_at: string;
}

const dayStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** First IST day of the calendar quarter holding `now`. */
export function quarterStart(now: Date): string {
  const today = istDay(now.getTime());
  const month = Number(today.slice(5, 7));
  const first = month - ((month - 1) % 3);
  return `${today.slice(0, 4)}-${String(first).padStart(2, "0")}-01`;
}

function emptyFigures(): SalesFigures {
  return { sales: 0, gmvPaise: 0, cashPaise: 0, upiPaise: 0 };
}

function add(f: SalesFigures, r: CaptureRow): void {
  f.sales += 1;
  f.gmvPaise += r.total_paise;
  if (r.pay_mode === "upi") f.upiPaise += r.total_paise;
  else f.cashPaise += r.total_paise;
}

/** "Groundnut Oil × 2, Ghee × 1" from a capture's stored items. */
function itemsText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .map((i) => {
      const it = i as { title?: unknown; qty?: unknown };
      return typeof it.title === "string" ? `${it.title} × ${Number(it.qty) || 1}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

/** A from/to pair the screen can trust: defaults to this month, never reversed. */
export function resolveRange(
  from: string | null | undefined,
  to: string | null | undefined,
  now: Date,
): { from: string; to: string } {
  const today = istDay(now.getTime());
  const a = from && ISO_DAY.test(from) ? from : today.slice(0, 8) + "01";
  const b = to && ISO_DAY.test(to) ? to : today;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** Fold the rows into the screen's figures. Pure: `rows` must reach back far enough. */
export function summariseSales(
  rows: CaptureRow[],
  opts: {
    now: Date;
    from: string;
    to: string;
    community: string | null;
    captainNames: Map<string, string>;
    assigned?: readonly string[];
  },
): CaptainAnalytics {
  const { now, from, to, community, captainNames } = opts;
  const windows = periodWindows(now);
  const today = istDay(now.getTime());
  const start = quarterStart(now);

  const periods = {} as Record<AnalyticsPeriod, PeriodFigures>;
  const spans: Record<AnalyticsPeriod, [string, number, number]> = {
    today: [today, Date.parse(windows.today.from), Date.parse(windows.today.to)],
    week: [windows.week.days[0], Date.parse(windows.week.from), Date.parse(windows.week.to)],
    month: [windows.month.days[0], Date.parse(windows.month.from), Date.parse(windows.month.to)],
    quarter: [start, dayStart(start), dayStart(nextDay(today))],
  };
  for (const key of ANALYTICS_PERIODS) periods[key] = { ...emptyFigures(), from: spans[key][0], to: today };

  const rangeFrom = dayStart(from);
  const rangeTo = dayStart(nextDay(to));
  const range = emptyFigures();
  const daily = new Map<string, { day: string; sales: number; gmvPaise: number }>();
  for (let d = from; d <= to && daily.size < 366; d = nextDay(d)) {
    daily.set(d, { day: d, sales: 0, gmvPaise: 0 });
  }
  const byCaptain = new Map<string, { captainId: string; name: string; sales: number; gmvPaise: number }>();
  const byCommunity = new Map<string, { community: string; sales: number; gmvPaise: number }>();
  const known = new Set<string>(opts.assigned ?? []);
  const inRange: CaptureRow[] = [];

  for (const r of rows) {
    if (r.community) known.add(r.community);
    if (community && r.community !== community) continue;
    const t = Date.parse(r.captured_at);
    if (!Number.isFinite(t)) continue;

    for (const key of ANALYTICS_PERIODS) {
      if (t >= spans[key][1] && t < spans[key][2]) add(periods[key], r);
    }
    if (t < rangeFrom || t >= rangeTo) continue;

    add(range, r);
    inRange.push(r);
    const d = daily.get(istDay(t));
    if (d) {
      d.sales += 1;
      d.gmvPaise += r.total_paise;
    }
    const cap = byCaptain.get(r.captain_id) ?? {
      captainId: r.captain_id,
      name: captainNames.get(r.captain_id) ?? "Captain",
      sales: 0,
      gmvPaise: 0,
    };
    cap.sales += 1;
    cap.gmvPaise += r.total_paise;
    byCaptain.set(r.captain_id, cap);

    const label = r.community ?? "No community";
    const com = byCommunity.get(label) ?? { community: label, sales: 0, gmvPaise: 0 };
    com.sales += 1;
    com.gmvPaise += r.total_paise;
    byCommunity.set(label, com);
  }

  const busiest = <T extends { gmvPaise: number }>(a: T, b: T) => b.gmvPaise - a.gmvPaise;
  return {
    periods,
    range: { ...range, from, to, daily: [...daily.values()] },
    byCaptain: [...byCaptain.values()].sort(busiest),
    byCommunity: [...byCommunity.values()].sort(busiest),
    communities: [...known].sort((a, b) => a.localeCompare(b)),
    sales: inRange
      .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
      .slice(0, SALES_SHOWN)
      .map((r) => ({
        id: r.id,
        captainId: r.captain_id,
        captainName: captainNames.get(r.captain_id) ?? "Captain",
        customerName: r.customer_name,
        customerMobile: r.customer_mobile,
        community: r.community,
        items: itemsText(r.items),
        totalPaise: r.total_paise,
        payMode: r.pay_mode === "upi" ? "upi" : "cash",
        capturedAt: r.captured_at,
      })),
  };
}

async function capturesSince(fromIso: string, captainId?: string): Promise<CaptureRow[]> {
  const rows: CaptureRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = supabaseAdmin()
      .from("captain_captures")
      .select("id, captain_id, customer_name, customer_mobile, community, items, total_paise, pay_mode, captured_at")
      .gte("captured_at", fromIso);
    if (captainId) q = q.eq("captain_id", captainId);
    const { data, error } = await q
      .order("captured_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data as CaptureRow[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** The analytics screen's data. Throws rather than reporting zero on a failed read. */
export async function captainAnalytics(
  query: { captainId?: string; community?: string | null; from?: string | null; to?: string | null },
  now: Date = new Date(),
): Promise<CaptainAnalytics> {
  const { from, to } = resolveRange(query.from, query.to, now);
  const earliest = [from, quarterStart(now)].sort()[0];
  const [rows, captains] = await Promise.all([
    capturesSince(new Date(dayStart(earliest)).toISOString(), query.captainId),
    listCaptains(false),
  ]);
  return summariseSales(rows, {
    now,
    from,
    to,
    community: query.community || null,
    captainNames: new Map(captains.map((c) => [c.id, c.name])),
    assigned: query.captainId
      ? captains.find((c) => c.id === query.captainId)?.communities ?? []
      : captains.flatMap((c) => c.communities),
  });
}

