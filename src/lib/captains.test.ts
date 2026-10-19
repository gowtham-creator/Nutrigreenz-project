import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eqOf, fakeDb, type Resolver } from "@/lib/__tests__/captain-fake-db";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: () => h.db }));
vi.mock("@/lib/customer-identity", () => ({ findCustomerByPhone: vi.fn(async () => null) }));
vi.mock("@/lib/captain-session", () => ({ requireCaptain: vi.fn() }));

import { requireCaptain } from "@/lib/captain-session";
import {
  addCapture,
  advancePickup,
  captainHasHistory,
  commissionPaiseFor,
  requireActiveCaptain,
  upsertSettlement,
} from "@/lib/captains";

const ID = "cap-1";
const captainRow = (over: Record<string, unknown> = {}) => ({
  id: ID, name: "Sneha", phone: "9876543210", area: null, stall: null, communities: [],
  commission_percent: 4, active: true, created_by: null, created_at: "x", updated_at: "x", ...over,
});
const withDb = (resolve: Resolver) => {
  const fake = fakeDb(resolve);
  h.db = fake.db;
  return fake;
};

afterEach(() => vi.useRealTimers());

describe("commissionPaiseFor", () => {
  it("rounds half up on exact integer maths (float maths gave 3 for 3.5 paise)", () => {
    expect(commissionPaiseFor(500, 0.7)).toBe(4);
    expect(commissionPaiseFor(224_850, 4)).toBe(8_994);
    expect(commissionPaiseFor(100_000, 7.5)).toBe(7_500);
    expect(commissionPaiseFor(0, 10)).toBe(0);
    expect(commissionPaiseFor(12_345, 0)).toBe(0);
  });
});

describe("upsertSettlement", () => {
  const settleDb = (captures: Array<{ total_paise: number; pay_mode: string }>) =>
    withDb((op) => {
      if (op.table === "captain_captures") return { data: captures.map((c) => ({ ...c, items: [{}] })) };
      if (op.table === "captains") return { data: captainRow({ commission_percent: 0.7 }) };
      if (op.table === "captain_settlements") {
        const p = op.payload as Record<string, unknown>;
        return { data: { id: "s1", submitted_at: "x", ...p } };
      }
    });

  it("lands an evening (19:00 IST) settlement on that IST day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T13:30:00Z"));
    const fake = settleDb([{ total_paise: 300, pay_mode: "cash" }, { total_paise: 200, pay_mode: "upi" }]);
    const s = await upsertSettlement(ID, 250);
    expect(s.settleDate).toBe("2026-10-19");
    const write = fake.ops.find((o) => o.action === "upsert")!;
    expect(write.payload).toMatchObject({
      settle_date: "2026-10-19",
      expected_gmv_paise: 500,
      cash_expected_paise: 300,
      upi_expected_paise: 200,
      cash_counted_paise: 250,
      variance_paise: -50,
      commission_paise: 4,
    });
    // Today's captures are read from the IST midnight, not UTC midnight.
    const read = fake.ops.find((o) => o.table === "captain_captures")!;
    expect(read.filters).toContainEqual(["gte", "captured_at", "2026-10-18T18:30:00.000Z"]);
  });

  it("lands a 01:30 IST settlement on the IST day, not the previous UTC day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T20:00:00Z")); // 01:30 IST on the 20th
    const fake = settleDb([]);
    const s = await upsertSettlement(ID, 0);
    expect(s.settleDate).toBe("2026-10-20");
    expect(fake.ops.find((o) => o.action === "upsert")!.options).toEqual({ onConflict: "captain_id,settle_date" });
  });
});

describe("advancePickup", () => {
  const pickupRow = (status: string) => ({
    id: "p1", captain_id: ID, community: "X", address: null, status, due_at: null, updated_at: "x", created_at: "x",
  });
  const pickupDb = (status: string, updated = true) =>
    withDb((op) => {
      if (op.action === "select") return { data: pickupRow(status) };
      if (op.action === "update") return { data: updated ? pickupRow((op.payload as { status: string }).status) : null };
    });

  it("allows the next step and makes the update conditional on the status read", async () => {
    const fake = pickupDb("due");
    const r = await advancePickup("p1", ID, "collected");
    expect(r).toMatchObject({ ok: true, pickup: { status: "collected" } });
    const update = fake.ops.find((o) => o.action === "update")!;
    expect(eqOf(update, "captain_id")).toBe(ID);
    expect(eqOf(update, "status")).toBe("due");
  });

  it("refuses skipping a step or going back", async () => {
    pickupDb("due");
    expect(await advancePickup("p1", ID, "handed_over")).toMatchObject({ ok: false, reason: "invalid_transition" });
    pickupDb("handed_over");
    expect(await advancePickup("p1", ID, "due")).toMatchObject({ ok: false, reason: "invalid_transition" });
    pickupDb("collected");
    expect(await advancePickup("p1", ID, "due")).toMatchObject({ ok: false, reason: "invalid_transition" });
  });

  it("treats re-sending the current status as a no-op success", async () => {
    const fake = pickupDb("collected");
    expect(await advancePickup("p1", ID, "collected")).toMatchObject({ ok: true, pickup: { status: "collected" } });
    expect(fake.ops.some((o) => o.action === "update")).toBe(false);
  });

  it("reports a lost race (no row updated) as an invalid transition", async () => {
    pickupDb("due", false);
    expect(await advancePickup("p1", ID, "collected")).toMatchObject({ ok: false, reason: "invalid_transition" });
  });

  it("is not-found for another captain's pickup", async () => {
    withDb(() => ({ data: null }));
    expect(await advancePickup("p1", "someone-else", "collected")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("addCapture idempotency", () => {
  const input = {
    customerName: "Lakshmi",
    customerMobile: "9876501234",
    items: [{ sku: "GNO-1L", title: "Oil", unit: "1L", pricePaise: 34_950, qty: 2, variantId: "v1", productId: "p1" }],
    payMode: "cash" as const,
    clientRef: "OFF-LOCAL-abc12345",
  };
  const stored = { id: "cap-row", captain_id: ID, customer_name: "Lakshmi", customer_mobile: "9876501234", community: null, items: [], total_paise: 69_900, pay_mode: "cash", notes: null, linked_customer_id: null, captured_at: "t" };

  it("returns the stored capture for a retried client ref without inserting", async () => {
    const fake = withDb((op) => (op.table === "captain_captures" && op.action === "select" ? { data: stored } : {}));
    const c = await addCapture(ID, input);
    expect(c.id).toBe("cap-row");
    expect(fake.ops.some((o) => o.action === "insert")).toBe(false);
  });

  it("stores the ref and a server-computed paise total", async () => {
    const fake = withDb((op) => (op.action === "insert" && op.table === "captain_captures" ? { data: stored } : {}));
    await addCapture(ID, input);
    const insert = fake.ops.find((o) => o.action === "insert" && o.table === "captain_captures")!;
    expect(insert.payload).toMatchObject({ client_ref: "OFF-LOCAL-abc12345", total_paise: 69_900 });
    const lines = fake.ops.find((o) => o.table === "captain_capture_lines")!;
    expect(lines.payload).toEqual([expect.objectContaining({ variant_id: "v1", unit_price_paise: 34_950, line_total_paise: 69_900 })]);
  });

  it("still records the sale when the client_ref column is not migrated yet", async () => {
    let inserts = 0;
    const fake = withDb((op) => {
      if (op.table !== "captain_captures") return {};
      if (op.action === "select") return { error: { code: "42703", message: "column client_ref does not exist" } };
      inserts += 1;
      return inserts === 1 ? { error: { code: "PGRST204", message: "Could not find the 'client_ref' column" } } : { data: stored };
    });
    const c = await addCapture(ID, input);
    expect(c.id).toBe("cap-row");
    const second = fake.ops.filter((o) => o.action === "insert" && o.table === "captain_captures")[1];
    expect(second.payload).not.toHaveProperty("client_ref");
  });

  it("returns the winner when a racing retry hits the unique index", async () => {
    let selects = 0;
    withDb((op) => {
      if (op.table !== "captain_captures") return {};
      if (op.action === "select") return (selects += 1) === 1 ? { data: null } : { data: stored };
      return { error: { code: "23505", message: "duplicate key" } };
    });
    expect((await addCapture(ID, input)).id).toBe("cap-row");
  });
});

describe("requireActiveCaptain", () => {
  beforeEach(() => {
    vi.mocked(requireCaptain).mockResolvedValue({ captainId: ID, phone: "9876543210" });
  });

  it("passes an active captain whose phone still matches", async () => {
    withDb(() => ({ data: captainRow() }));
    expect(await requireActiveCaptain()).toEqual({ captainId: ID, phone: "9876543210" });
  });

  it.each([
    ["deactivated", captainRow({ active: false })],
    ["phone moved", captainRow({ phone: "9000000000" })],
    ["deleted", null],
  ])("401s a session whose captain was %s", async (_label, row) => {
    withDb(() => ({ data: row }));
    const res = await requireActiveCaptain();
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });
});

describe("captainHasHistory", () => {
  it("is true when captures exist, and fails closed on a read error", async () => {
    withDb((op) => (op.table === "captain_captures" ? { data: [{ id: "c" }] } : { data: [] }));
    expect(await captainHasHistory(ID)).toBe(true);
    withDb(() => ({ data: [] }));
    expect(await captainHasHistory(ID)).toBe(false);
    withDb(() => ({ error: { message: "boom" } }));
    expect(await captainHasHistory(ID)).toBe(true);
  });
});
