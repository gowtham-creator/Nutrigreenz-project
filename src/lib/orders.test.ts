/**
 * Payment-state data access in src/lib/orders.ts.
 *
 * The Supabase client is replaced by a recording fake (src/test/fake-supabase.ts)
 * so each test can assert exactly which filters a query carried — that is where
 * the payment-state invariants live (e.g. a sweep that must only ever see online
 * orders). The reward engine, promotions and commerce rules are mocked at their
 * module boundary; nothing here reaches a database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type FakeOp, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));
vi.mock("@/lib/commerce-rules", () => ({ getCommerceRules: vi.fn() }));
vi.mock("@/lib/promotions", () => ({
  getActivePromotions: vi.fn(),
  promoPercentForVariant: vi.fn(),
  applyPromoPaise: vi.fn(),
}));
vi.mock("@/lib/referrals", () => ({ rewardReferralIfEligible: vi.fn() }));
vi.mock("@/lib/rewards", () => {
  class CouponInvalidError extends Error {}
  return {
    CouponInvalidError,
    validateCouponServer: vi.fn(),
    quoteLoyaltyRedemption: vi.fn(),
    recordCouponUse: vi.fn(),
    redeemPoints: vi.fn(),
    earnPointsForOrder: vi.fn(),
  };
});

import { listStalePendingPayments, transitionOrderPayment } from "@/lib/orders";

/** A raw `orders` row, the way PostgREST returns it. */
function orderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ord-1",
    order_number: "NG-26-1001",
    customer_id: "cust-1",
    user_email: "asha@example.com",
    user_phone: "+919800000000",
    status: "placed",
    payment_status: "pending",
    payment_provider: "none",
    payment_method: "upi",
    paid_at: null,
    payment_ref: null,
    subtotal_paise: 220_000,
    discount_paise: 0,
    shipping_paise: 0,
    tax_paise: 0,
    total_paise: 220_000,
    coupon_code: null,
    loyalty_redeemed_paise: 0,
    currency: "INR",
    address_snapshot: null,
    slot_snapshot: null,
    placed_at: "2026-10-01T10:00:00Z",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

/**
 * Install a fake database. Reads of the order (and its empty item/event lists)
 * are answered here; everything else goes to `extra`.
 */
function useDb(extra: Responder = () => undefined, order: Record<string, unknown> = orderRow()) {
  const fake = createFakeSupabase((op) => {
    const custom = extra(op);
    if (custom) return custom;
    if (op.table === "orders" && op.action === "select") return { data: order };
    if (op.table === "order_items" || op.table === "order_status_events") return { data: [] };
    return undefined;
  });
  h.db = fake.client;
  return fake;
}

const updatesTo = (ops: FakeOp[], table: string) =>
  ops.filter((o) => o.table === table && o.action === "update");

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listStalePendingPayments", () => {
  it("only ever lists pending ONLINE orders — a COD order is pending by design", async () => {
    const fake = useDb((op) =>
      op.table === "orders"
        ? {
            data: [
              { id: "ord-1", order_number: "NG-26-1001", total_paise: 220_000, created_at: "2026-10-01T10:00:00Z" },
            ],
          }
        : undefined,
    );

    const rows = await listStalePendingPayments();

    const query = fake.ops.find((o) => o.table === "orders" && o.action === "select");
    expect(filterOn(query!, "payment_status", "eq")?.value).toBe("pending");
    expect(filterOn(query!, "payment_method", "eq")?.value).toBe("upi");
    expect(rows).toEqual([
      { id: "ord-1", orderNumber: "NG-26-1001", totalPaise: 220_000, createdAt: "2026-10-01T10:00:00Z" },
    ]);
  });
});

describe("transitionOrderPayment — online orders only", () => {
  it("scopes the compare-and-set to payment_method = upi so a COD order can never be flipped", async () => {
    const fake = useDb((op) =>
      op.table === "orders" && op.action === "update" ? { data: [{ id: "ord-1" }] } : undefined,
    );

    const won = await transitionOrderPayment("ord-1", "pending", "failed", "SBI-REF-1");

    expect(won).not.toBeNull();
    const [update] = updatesTo(fake.ops, "orders");
    expect(filterOn(update, "id", "eq")?.value).toBe("ord-1");
    expect(filterOn(update, "payment_method", "eq")?.value).toBe("upi");
    expect(filterOn(update, "payment_status")?.value).toEqual(["pending"]);
  });

  it("returns null and changes nothing when the guard matches no row (e.g. a COD order)", async () => {
    useDb((op) => (op.table === "orders" && op.action === "update" ? { data: [] } : undefined));

    expect(await transitionOrderPayment("ord-1", "pending", "failed")).toBeNull();
  });
});

describe("transitionOrderPayment — failed → paid recovery", () => {
  it("accepts a SET of source states, still as one atomic compare-and-set", async () => {
    const fake = useDb((op) =>
      op.table === "orders" && op.action === "update" ? { data: [{ id: "ord-1" }] } : undefined,
    );

    const won = await transitionOrderPayment("ord-1", ["pending", "failed"], "paid", "SBI-REF-1");

    expect(won).not.toBeNull();
    const updates = updatesTo(fake.ops, "orders");
    expect(updates).toHaveLength(1);
    expect(filterOn(updates[0], "payment_status", "in")?.value).toEqual(["pending", "failed"]);
    expect((updates[0].payload as Record<string, unknown>).payment_status).toBe("paid");
  });

  it("lets only one of two concurrent recoveries win (the loser's guard matches no row)", async () => {
    // The database applies the guard; model that: the first update finds a
    // 'failed' row, the second finds it already 'paid'.
    let status = "failed";
    useDb((op) => {
      if (op.table !== "orders" || op.action !== "update") return undefined;
      const from = filterOn(op, "payment_status", "in")?.value as string[];
      if (!from.includes(status)) return { data: [] };
      status = "paid";
      return { data: [{ id: "ord-1" }] };
    });

    const [a, b] = await Promise.all([
      transitionOrderPayment("ord-1", ["pending", "failed"], "paid", "SBI-REF-1"),
      transitionOrderPayment("ord-1", ["pending", "failed"], "paid", "SBI-REF-1"),
    ]);

    expect([a, b].filter((r) => r !== null)).toHaveLength(1);
  });

  it("never moves an order OUT of paid, whatever the caller asks for", async () => {
    const fake = useDb();

    expect(await transitionOrderPayment("ord-1", "paid", "failed")).toBeNull();
    expect(await transitionOrderPayment("ord-1", ["pending", "paid"], "failed")).toBeNull();
    expect(updatesTo(fake.ops, "orders")).toHaveLength(0);
  });

  it("refuses an empty source set and a no-op transition without querying", async () => {
    const fake = useDb();

    expect(await transitionOrderPayment("ord-1", [], "paid")).toBeNull();
    expect(await transitionOrderPayment("ord-1", "failed", "failed")).toBeNull();
    expect(fake.ops).toHaveLength(0);
  });
});
