/**
 * Captain conversions: which of a captain's offline customers went on to buy
 * from the online store.
 *
 * A captain meets a customer in one of two ways: a stall sale (the capture
 * records their mobile) or an operator registering them in Super Admin with the
 * captain who introduced them. Either way the person is keyed by their 10-digit
 * mobile, and online orders are matched to them by the phone on the order or on
 * the customer who placed it.
 *
 * Rules, chosen so a commission paid on a conversion is defensible:
 *   - First touch wins. The captain who met the person first gets the credit,
 *     and only once, however many captains sell to them later.
 *   - Only orders placed AFTER that first touch count. Someone who already
 *     shopped online before the captain met them is "already online", not a
 *     conversion, and stays out of the rate.
 *   - Cancelled orders and failed payments never count.
 *
 * Service-role only. Money is integer paise.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listCaptains, normalizeMobile10 } from "@/lib/captains";

export type ConversionStatus = "converted" | "already-online" | "not-yet";

export interface OfflineTouch {
  captainId: string;
  mobile: string;
  name: string | null;
  at: string;
  kind: "sale" | "registered";
  /** Stall sale value, paise. 0 for a registration. */
  paise: number;
}

export interface OnlineOrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  user_phone: string | null;
  total_paise: number;
  placed_at: string;
}

export interface ConvertedCustomer {
  mobile: string;
  name: string | null;
  captainId: string;
  /** How and when the captain first met them. */
  via: "sale" | "registered";
  firstTouchAt: string;
  offlineSales: number;
  offlinePaise: number;
  status: ConversionStatus;
  firstOnlineAt: string | null;
  firstOnlineOrder: string | null;
  onlineOrders: number;
  onlinePaise: number;
  daysToConvert: number | null;
}

export interface CaptainConversionSummary {
  captainId: string;
  name: string;
  offlineCustomers: number;
  converted: number;
  alreadyOnline: number;
  /** Converted out of those who were not online already, 0 to 1. */
  rate: number;
  onlineOrders: number;
  onlinePaise: number;
  medianDaysToConvert: number | null;
}

export interface ConversionReport {
  overall: Omit<CaptainConversionSummary, "captainId" | "name">;
  captains: CaptainConversionSummary[];
  customers: ConvertedCustomer[];
}

const DAY_MS = 86_400_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function summarise(rows: ConvertedCustomer[]): Omit<CaptainConversionSummary, "captainId" | "name"> {
  const converted = rows.filter((r) => r.status === "converted");
  const alreadyOnline = rows.filter((r) => r.status === "already-online").length;
  const eligible = rows.length - alreadyOnline;
  return {
    offlineCustomers: rows.length,
    converted: converted.length,
    alreadyOnline,
    rate: eligible > 0 ? converted.length / eligible : 0,
    onlineOrders: converted.reduce((n, r) => n + r.onlineOrders, 0),
    onlinePaise: converted.reduce((n, r) => n + r.onlinePaise, 0),
    medianDaysToConvert: median(converted.map((r) => r.daysToConvert ?? 0)),
  };
}

/**
 * Match offline touches to online orders. Pure: `orderPhone` gives each order's
 * 10-digit mobile, already resolved from the order or its customer.
 */
export function buildConversions(
  touches: OfflineTouch[],
  orders: OnlineOrderRow[],
  orderPhone: (o: OnlineOrderRow) => string | null,
  captainNames: Map<string, string>,
): ConversionReport {
  // First touch per mobile decides the captain; later touches by the same
  // captain still count as their offline sales.
  const byMobile = new Map<string, ConvertedCustomer>();
  for (const t of [...touches].sort((a, b) => a.at.localeCompare(b.at))) {
    let c = byMobile.get(t.mobile);
    if (!c) {
      c = {
        mobile: t.mobile,
        name: t.name,
        captainId: t.captainId,
        via: t.kind,
        firstTouchAt: t.at,
        offlineSales: 0,
        offlinePaise: 0,
        status: "not-yet",
        firstOnlineAt: null,
        firstOnlineOrder: null,
        onlineOrders: 0,
        onlinePaise: 0,
        daysToConvert: null,
      };
      byMobile.set(t.mobile, c);
    }
    if (!c.name && t.name) c.name = t.name;
    if (t.captainId === c.captainId && t.kind === "sale") {
      c.offlineSales += 1;
      c.offlinePaise += t.paise;
    }
  }

  const before = new Set<string>();
  for (const o of [...orders].sort((a, b) => a.placed_at.localeCompare(b.placed_at))) {
    const mobile = orderPhone(o);
    const c = mobile ? byMobile.get(mobile) : undefined;
    if (!c) continue;
    if (o.placed_at < c.firstTouchAt) {
      before.add(c.mobile);
      continue;
    }
    if (!c.firstOnlineAt) {
      c.firstOnlineAt = o.placed_at;
      c.firstOnlineOrder = o.order_number;
      c.daysToConvert = Math.max(0, Math.floor((Date.parse(o.placed_at) - Date.parse(c.firstTouchAt)) / DAY_MS));
    }
    c.onlineOrders += 1;
    c.onlinePaise += o.total_paise;
  }

  const customers = [...byMobile.values()].map((c) => ({
    ...c,
    status: (before.has(c.mobile) ? "already-online" : c.firstOnlineAt ? "converted" : "not-yet") as ConversionStatus,
  }));
  // A customer who was online first keeps their orders listed but earns no credit.
  for (const c of customers) {
    if (c.status === "already-online") c.daysToConvert = null;
  }

  const perCaptain = new Map<string, ConvertedCustomer[]>();
  for (const c of customers) perCaptain.set(c.captainId, [...(perCaptain.get(c.captainId) ?? []), c]);

  return {
    overall: summarise(customers),
    captains: [...perCaptain.entries()]
      .map(([captainId, rows]) => ({ captainId, name: captainNames.get(captainId) ?? "Captain", ...summarise(rows) }))
      .sort((a, b) => b.converted - a.converted || b.offlineCustomers - a.offlineCustomers),
    customers: customers.sort(
      (a, b) =>
        (b.firstOnlineAt ?? "").localeCompare(a.firstOnlineAt ?? "") || b.firstTouchAt.localeCompare(a.firstTouchAt),
    ),
  };
}

/** Postgres / PostgREST wording for a table that has not been created yet. */
const MISSING_TABLE = /does not exist|42P01|schema cache|Could not find the table/i;

const PAGE = 1000;
const MAX_PAGES = 50;

async function pages<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await read(p * PAGE, p * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data as T[] | null) ?? [];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

/**
 * The conversion report, for everyone or one captain. Throws on a failed read.
 *
 * Always built from every captain's touches, even for one captain: who met a
 * customer first can only be decided with the whole picture.
 */
export async function conversionReport(captainId?: string): Promise<ConversionReport> {
  const db = supabaseAdmin();
  const [captures, intros, captains] = await Promise.all([
    pages<{ captain_id: string; customer_mobile: string; customer_name: string | null; captured_at: string; total_paise: number }>(
      (from, to) =>
        db
          .from("captain_captures")
          .select("captain_id, customer_mobile, customer_name, captured_at, total_paise")
          .order("captured_at", { ascending: true })
          .range(from, to),
    ),
    pages<{ captain_id: string; mobile: string; name: string | null; created_at: string }>((from, to) =>
      db
        .from("captain_customer_intros")
        .select("captain_id, mobile, name, created_at")
        .order("created_at", { ascending: true })
        .range(from, to),
    ).catch((err: Error) => {
      // Before its migration runs, registered customers simply don't exist yet;
      // stall-sale conversions still work.
      if (MISSING_TABLE.test(err.message)) return [];
      throw err;
    }),
    listCaptains(false),
  ]);

  const touches: OfflineTouch[] = [
    ...captures.flatMap((r) => {
      const mobile = normalizeMobile10(r.customer_mobile);
      return mobile
        ? [{ captainId: r.captain_id, mobile, name: r.customer_name, at: r.captured_at, kind: "sale" as const, paise: r.total_paise }]
        : [];
    }),
    ...intros.map((r) => ({ captainId: r.captain_id, mobile: r.mobile, name: r.name, at: r.created_at, kind: "registered" as const, paise: 0 })),
  ];
  const names = new Map(captains.map((c) => [c.id, c.name]));

  let orders: OnlineOrderRow[] = [];
  const phoneOfCustomer = new Map<string, string>();
  if (touches.length > 0) {
    // Every order is read, not only those after the first touch: an earlier one
    // is what marks someone "already online" rather than converted.
    orders = await pages<OnlineOrderRow>((from, to) =>
      db
        .from("orders")
        .select("id, order_number, customer_id, user_phone, total_paise, placed_at")
        .neq("status", "cancelled")
        .neq("payment_status", "failed")
        .order("placed_at", { ascending: true })
        .range(from, to),
    );
    const ids = [...new Set(orders.map((o) => o.customer_id).filter((id): id is string => Boolean(id)))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db.from("customers").select("id, primary_phone").in("id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const c of (data as { id: string; primary_phone: string | null }[] | null) ?? []) {
        const ten = normalizeMobile10(c.primary_phone);
        if (ten) phoneOfCustomer.set(c.id, ten);
      }
    }
  }

  const known = new Set(touches.map((t) => t.mobile));
  // The order's own phone first, when it is one a captain knows; otherwise the
  // phone on the account that placed it.
  const orderPhone = (o: OnlineOrderRow) => {
    const own = normalizeMobile10(o.user_phone);
    if (own && known.has(own)) return own;
    return (o.customer_id ? phoneOfCustomer.get(o.customer_id) : undefined) ?? own;
  };

  const report = buildConversions(touches, orders, orderPhone, names);
  if (!captainId) return report;
  const customers = report.customers.filter((c) => c.captainId === captainId);
  return {
    overall: summarise(customers),
    captains: report.captains.filter((c) => c.captainId === captainId),
    customers,
  };
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: "invalid-mobile" | "captain-unavailable" | "already-registered" | "setup-pending"; captainName?: string };

/** Register an offline customer against the captain who introduced them. */
export async function registerOfflineCustomer(input: {
  captainId: string;
  mobile: string;
  name: string | null;
  byEmail: string;
}): Promise<RegisterResult> {
  const mobile = normalizeMobile10(input.mobile);
  if (!mobile) return { ok: false, error: "invalid-mobile" };
  const captains = await listCaptains(false);
  const captain = captains.find((c) => c.id === input.captainId);
  if (!captain) return { ok: false, error: "captain-unavailable" };

  const db = supabaseAdmin();
  const { data: existing, error: readError } = await db
    .from("captain_customer_intros")
    .select("captain_id")
    .eq("mobile", mobile)
    .maybeSingle();
  if (readError && MISSING_TABLE.test(readError.message)) return { ok: false, error: "setup-pending" };
  if (existing) {
    const owner = captains.find((c) => c.id === (existing as { captain_id: string }).captain_id);
    return { ok: false, error: "already-registered", captainName: owner?.name };
  }
  const { error } = await db.from("captain_customer_intros").insert({
    captain_id: captain.id,
    mobile,
    name: input.name?.trim().slice(0, 120) || null,
    registered_by: input.byEmail,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "already-registered" };
    throw new Error(error.message);
  }
  return { ok: true };
}
