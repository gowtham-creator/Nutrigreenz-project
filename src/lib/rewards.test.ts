/**
 * Rewards bookkeeping for an order that is voided or recovered.
 *
 * An online order reserves a coupon use and burns loyalty points when it is
 * created, before the customer has paid. If it never gets paid those must be
 * given back, and if it turns out to have been paid after all they must be
 * taken again - each exactly once.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type FakeOp, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));
vi.mock("@/lib/customer-identity", () => ({ hasVerifiedPhone: vi.fn() }));
vi.mock("@/lib/commerce-rules", () => ({ communitiesForPincode: vi.fn() }));

import {
  earnPointsForOrder,
  releaseRedeemedPoints,
  reburnReleasedPoints,
  removeCouponUsesForOrder,
} from "@/lib/rewards";

function useDb(respond: Responder) {
  const fake = createFakeSupabase(respond);
  h.db = fake.client;
  return fake;
}

const inserts = (ops: FakeOp[], table: string) =>
  ops.filter((o) => o.table === table && o.action === "insert").map((o) => o.payload);

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("removeCouponUsesForOrder", () => {
  it("deletes the order's redemption and re-counts the coupon so its limit is honest again", async () => {
    const fake = useDb((op) => {
      if (op.table === "coupon_uses" && op.action === "select") {
        // The re-count is a head/count query; the lookup is by order.
        return op.head ? { count: 3 } : { data: [{ coupon_id: "coupon-1" }] };
      }
      return undefined;
    });

    const removed = await removeCouponUsesForOrder("ord-1");

    expect(removed).toBe(1);
    const del = fake.ops.find((o) => o.table === "coupon_uses" && o.action === "delete");
    expect(filterOn(del!, "order_id", "eq")?.value).toBe("ord-1");
    const recount = fake.ops.find((o) => o.table === "coupons" && o.action === "update");
    expect(recount?.payload).toEqual({ used_count: 3 });
    expect(filterOn(recount!, "id", "eq")?.value).toBe("coupon-1");
  });

  it("does nothing for an order that used no coupon", async () => {
    const fake = useDb((op) => (op.table === "coupon_uses" ? { data: [] } : undefined));

    expect(await removeCouponUsesForOrder("ord-1")).toBe(0);
    expect(fake.ops.some((o) => o.action === "delete")).toBe(false);
  });
});

describe("releaseRedeemedPoints", () => {
  it("credits back exactly the points the order burned", async () => {
    const fake = useDb((op) =>
      op.table === "loyalty_ledger" && op.action === "select"
        ? { data: [{ delta_points: -300, reason: "order_redeem" }] }
        : undefined,
    );

    const restored = await releaseRedeemedPoints("cust-1", "ord-1");

    expect(restored).toBe(300);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([
      { customer_id: "cust-1", order_id: "ord-1", delta_points: 300, reason: "adjust" },
    ]);
  });

  it("is idempotent: once restored, a second call adds nothing", async () => {
    const fake = useDb((op) =>
      op.table === "loyalty_ledger" && op.action === "select"
        ? {
            data: [
              { delta_points: -300, reason: "order_redeem" },
              { delta_points: 300, reason: "adjust" },
            ],
          }
        : undefined,
    );

    expect(await releaseRedeemedPoints("cust-1", "ord-1")).toBe(0);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([]);
  });

  it("does nothing for an order that burned no points", async () => {
    const fake = useDb((op) => (op.table === "loyalty_ledger" ? { data: [] } : undefined));

    expect(await releaseRedeemedPoints("cust-1", "ord-1")).toBe(0);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([]);
  });
});

describe("reburnReleasedPoints", () => {
  it("burns again the points that were given back, when the customer still has them", async () => {
    const fake = useDb((op) => {
      if (op.table !== "loyalty_ledger" || op.action !== "select") return undefined;
      // First read: this order's compensation rows; second: the live balance.
      return filterOn(op, "order_id")
        ? { data: [{ delta_points: 300, reason: "adjust" }] }
        : { data: [{ delta_points: 1000 }] };
    });

    expect(await reburnReleasedPoints("cust-1", "ord-1")).toBe(300);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([
      { customer_id: "cust-1", order_id: "ord-1", delta_points: -300, reason: "order_redeem" },
    ]);
  });

  it("never drives the balance negative: burns only what is left", async () => {
    const fake = useDb((op) => {
      if (op.table !== "loyalty_ledger" || op.action !== "select") return undefined;
      return filterOn(op, "order_id")
        ? { data: [{ delta_points: 300, reason: "adjust" }] }
        : { data: [{ delta_points: 120 }] };
    });

    expect(await reburnReleasedPoints("cust-1", "ord-1")).toBe(120);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([
      { customer_id: "cust-1", order_id: "ord-1", delta_points: -120, reason: "order_redeem" },
    ]);
  });
});

describe("earnPointsForOrder — idempotent", () => {
  it("credits once, and a second call for the same order credits nothing", async () => {
    let earned = false;
    const fake = useDb((op) => {
      if (op.table === "loyalty_config") return { data: null };
      if (op.table === "loyalty_ledger" && op.action === "select") {
        return { data: earned ? [{ id: "row-1" }] : [] };
      }
      if (op.table === "loyalty_ledger" && op.action === "insert") {
        earned = true;
        return {};
      }
      return undefined;
    });

    const first = await earnPointsForOrder("cust-1", "ord-1", 220_000);
    const second = await earnPointsForOrder("cust-1", "ord-1", 220_000);

    expect(first).toBe(2200);
    expect(second).toBe(0);
    expect(inserts(fake.ops, "loyalty_ledger")).toHaveLength(1);
  });
});
