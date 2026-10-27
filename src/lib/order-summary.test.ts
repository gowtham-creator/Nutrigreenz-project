/**
 * The Orders portal summary: what counts in each period, what each figure
 * means, and the one paged read behind all three periods.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown, slots: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));
vi.mock("@/lib/commerce-rules", () => ({ listDeliverySlots: async () => h.slots }));

import { buildOrderSummary, periodWindows, summarisePeriods, type SummaryOrderRow } from "./order-summary";

// Tuesday 27 Oct 2026, 7:00 PM IST.
const NOW = new Date("2026-10-27T13:30:00Z");
const W = periodWindows(NOW);

/** An order placed at the given IST wall-clock time. */
function order(istLocal: string, patch: Partial<SummaryOrderRow> = {}): SummaryOrderRow {
  return {
    status: "placed",
    payment_status: "pending",
    total_paise: 10_000,
    placed_at: new Date(`${istLocal}+05:30`).toISOString(),
    slot_snapshot: { id: "slot-am", label: "Morning" },
    ...patch,
  };
}

const ROWS: SummaryOrderRow[] = [
  // Today
  order("2026-10-27T09:00:00", { total_paise: 20_000, status: "delivered", payment_status: "paid" }),
  order("2026-10-27T11:00:00", { total_paise: 30_000 }),
  order("2026-10-27T12:00:00", { status: "cancelled", total_paise: 99_000 }),
  order("2026-10-27T00:05:00", { slot_snapshot: { id: "morning", label: "Morning · 7–10 AM" } }),
  // Yesterday: one before 7 PM (counts as "by this time"), one after (does not).
  order("2026-10-26T10:00:00"),
  order("2026-10-26T21:00:00"),
  // Earlier this month, and last month.
  order("2026-10-05T10:00:00", { slot_snapshot: null }),
  order("2026-09-20T10:00:00"),
  order("2026-09-29T23:00:00"), // after "this point" in September: excluded from the month comparison
];

describe("summarisePeriods", () => {
  const p = summarisePeriods(ROWS, W, NOW, new Map([["slot-am", "Morning"]]));

  it("counts today's orders, keeping cancelled ones out of the money", () => {
    expect(p.today.orders).toBe(4);
    expect(p.today.cancelled).toBe(1);
    expect(p.today.delivered).toBe(1);
    expect(p.today.bookedPaise).toBe(60_000);
    expect(p.today.collectedPaise).toBe(20_000);
    expect(p.today.paymentPending).toBe(2);
    expect(p.today.avgOrderPaise).toBe(20_000);
    expect(p.today.byStatus).toMatchObject({ placed: 2, delivered: 1, cancelled: 1, shipped: 0 });
  });

  it("compares with yesterday only up to the same time of day", () => {
    expect(p.today.previous.orders).toBe(1);
  });

  it("puts Monday and Tuesday in this week, and the 5th in this month only", () => {
    expect(p.week.orders).toBe(6);
    expect(p.month.orders).toBe(7);
    expect(p.week.daily.map((d) => [d.day, d.orders])).toEqual([
      ["2026-10-26", 2],
      ["2026-10-27", 4],
    ]);
  });

  it("compares the month with last month up to the same point", () => {
    expect(p.month.previous.orders).toBe(1);
  });

  it("zero-fills the daily series and leaves cancelled value out of it", () => {
    expect(p.month.daily).toHaveLength(27);
    expect(p.month.daily.find((d) => d.day === "2026-10-02")).toEqual({ day: "2026-10-02", orders: 0, bookedPaise: 0 });
    expect(p.today.daily).toEqual([{ day: "2026-10-27", orders: 4, bookedPaise: 60_000 }]);
  });

  it("groups slots by configured id, falls back to the label for old ids, and names missing ones", () => {
    expect(p.today.slots).toEqual([
      { id: "slot-am", label: "Morning", orders: 3 },
      { id: null, label: "Morning · 7–10 AM", orders: 1 },
    ]);
    expect(p.month.slots).toContainEqual({ id: null, label: "No slot chosen", orders: 1 });
  });
});

describe("buildOrderSummary", () => {
  let respond: Responder;

  beforeEach(() => {
    h.slots = [
      { id: "slot-am", label: "Morning", windowText: "7–10 AM", sort: 0, active: true },
      { id: "slot-pm", label: "Evening", windowText: "5–8 PM", sort: 1, active: false },
    ];
  });

  function install(r: Responder) {
    respond = r;
    const fake = createFakeSupabase((op) => respond(op));
    h.db = fake.client;
    return fake;
  }

  it("reads from the start of last month, page by page, and counts the open backlog", async () => {
    let page = 0;
    const fake = install((op) => {
      if (op.head) {
        const status = filterOn(op, "status", "eq")?.value;
        const counts: Record<string, number> = { placed: 3, confirmed: 2, packed: 1, shipped: 4 };
        return { count: status ? counts[String(status)] ?? 0 : 5 };
      }
      page += 1;
      // A full first page means "there may be more"; the short second one ends it.
      const rows = page === 1 ? Array.from({ length: 1000 }, () => order("2026-10-27T10:00:00")) : [order("2026-10-27T11:00:00")];
      return { data: rows };
    });

    const s = await buildOrderSummary(NOW);

    const reads = fake.ops.filter((op) => op.table === "orders" && !op.head);
    expect(reads).toHaveLength(2);
    expect(filterOn(reads[0], "placed_at", "gte")?.value).toBe("2026-08-31T18:30:00.000Z");
    expect(s.periods.today.orders).toBe(1001);
    expect(s.open).toEqual({ placed: 3, confirmed: 2, packed: 1, shipped: 4, paymentPending: 5 });

    const pending = fake.ops.find((op) => op.head && filterOn(op, "payment_status"));
    expect(filterOn(pending!, "status", "neq")?.value).toBe("cancelled");
  });

  it("reports every slot with its open/closed state and today's orders", async () => {
    install((op) => (op.head ? { count: 0 } : { data: [order("2026-10-27T10:00:00")] }));

    const s = await buildOrderSummary(NOW);

    expect(s.slots).toEqual([
      { id: "slot-am", label: "Morning", windowText: "7–10 AM", sort: 0, active: true, todayOrders: 1 },
      { id: "slot-pm", label: "Evening", windowText: "5–8 PM", sort: 1, active: false, todayOrders: 0 },
    ]);
  });

  it("fails loudly rather than reporting zero when the read fails", async () => {
    install((op) => (op.head ? { count: 0 } : { error: { message: "timeout" } }));
    await expect(buildOrderSummary(NOW)).rejects.toThrow("timeout");
  });
});
