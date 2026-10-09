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
import {
  createFakeSupabase,
  filterOn,
  type FakeOp,
  type Responder,
  type RpcResponder,
} from "@/test/fake-supabase";

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
    removeCouponUsesForOrder: vi.fn(),
    releaseRedeemedPoints: vi.fn(),
    reburnReleasedPoints: vi.fn(),
  };
});

import * as rewards from "@/lib/rewards";
import { getCommerceRules } from "@/lib/commerce-rules";
import { getActivePromotions } from "@/lib/promotions";
import {
  createOrder,
  failUnpaidOnlineOrder,
  listStalePendingPayments,
  onOnlineOrderPaid,
  reapplyOrderHolds,
  recordGatewayHandoff,
  releaseOrderHolds,
  transitionOrderPayment,
} from "@/lib/orders";

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
function installDb(
  extra: Responder = () => undefined,
  order: Record<string, unknown> = orderRow(),
  rpc?: RpcResponder,
) {
  const fake = createFakeSupabase((op) => {
    const custom = extra(op);
    if (custom) return custom;
    if (op.table === "orders" && op.action === "select") return { data: order };
    if (op.table === "order_items" || op.table === "order_status_events") return { data: [] };
    return undefined;
  }, rpc);
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
    const fake = installDb((op) =>
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
    const fake = installDb((op) =>
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
    installDb((op) => (op.table === "orders" && op.action === "update" ? { data: [] } : undefined));

    expect(await transitionOrderPayment("ord-1", "pending", "failed")).toBeNull();
  });
});

describe("transitionOrderPayment — failed → paid recovery", () => {
  it("accepts a SET of source states, still as one atomic compare-and-set", async () => {
    const fake = installDb((op) =>
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
    installDb((op) => {
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
    const fake = installDb();

    expect(await transitionOrderPayment("ord-1", "paid", "failed")).toBeNull();
    expect(await transitionOrderPayment("ord-1", ["pending", "paid"], "failed")).toBeNull();
    expect(updatesTo(fake.ops, "orders")).toHaveLength(0);
  });

  it("refuses an empty source set and a no-op transition without querying", async () => {
    const fake = installDb();

    expect(await transitionOrderPayment("ord-1", [], "paid")).toBeNull();
    expect(await transitionOrderPayment("ord-1", "failed", "failed")).toBeNull();
    expect(fake.ops).toHaveLength(0);
  });
});

describe("transitionOrderPayment — the stored gateway reference", () => {
  it("records the reference it is given", async () => {
    const fake = installDb((op) =>
      op.table === "orders" && op.action === "update" ? { data: [{ id: "ord-1" }] } : undefined,
    );

    await transitionOrderPayment("ord-1", "pending", "failed", "SBI-REF-1");

    expect((updatesTo(fake.ops, "orders")[0].payload as Record<string, unknown>).payment_ref).toBe(
      "SBI-REF-1",
    );
  });

  it("never blanks the stored reference when the caller has none to give", async () => {
    // The callback and sweep pass `result.reference ?? null`; a status lookup
    // that returned nothing must not erase the reference saved at handoff.
    const fake = installDb((op) =>
      op.table === "orders" && op.action === "update" ? { data: [{ id: "ord-1" }] } : undefined,
    );

    await transitionOrderPayment("ord-1", "pending", "failed", null);
    await transitionOrderPayment("ord-1", "pending", "failed");

    for (const update of updatesTo(fake.ops, "orders")) {
      expect(update.payload).not.toHaveProperty("payment_ref");
    }
  });
});

describe("recordGatewayHandoff", () => {
  it("saves SBI's order reference on the still-pending online order", async () => {
    const fake = installDb((op) =>
      op.table === "orders" && op.action === "update" ? { data: [{ id: "ord-1" }] } : undefined,
    );

    const ok = await recordGatewayHandoff("ord-1", "SBI-REF-1");

    expect(ok).toBe(true);
    const [update] = updatesTo(fake.ops, "orders");
    expect(update.payload).toMatchObject({ payment_ref: "SBI-REF-1", payment_provider: "sbiepay" });
    expect(filterOn(update, "id", "eq")?.value).toBe("ord-1");
    expect(filterOn(update, "payment_status", "eq")?.value).toBe("pending");
    expect(filterOn(update, "payment_method", "eq")?.value).toBe("upi");
  });

  it("is best-effort: a failed write is reported, not thrown (the order is still payable)", async () => {
    installDb((op) =>
      op.table === "orders" && op.action === "update"
        ? { error: { message: "connection reset" } }
        : undefined,
    );

    await expect(recordGatewayHandoff("ord-1", "SBI-REF-1")).resolves.toBe(false);
  });

  it("does nothing when the gateway gave no reference", async () => {
    const fake = installDb();

    await expect(recordGatewayHandoff("ord-1", undefined)).resolves.toBe(false);
    expect(fake.ops).toHaveLength(0);
  });
});

/** The lines an order reserved stock for: two of one variant, plus a product-only line. */
const ITEMS = [
  { variant_id: "var-1", qty: 2 },
  { variant_id: "var-2", qty: 1 },
  { variant_id: null, qty: 1 },
];

/**
 * A database where the held-state marker can be claimed (the migration is
 * applied). `released` is the marker's starting state.
 */
function holdsDb(extra: Responder = () => undefined, rpc?: RpcResponder, released = false) {
  let marker: string | null = released ? "2026-10-01T10:30:00Z" : null;
  return installDb(
    (op) => {
      const custom = extra(op);
      if (custom) return custom;
      if (op.table === "order_items" && op.action === "select") return { data: ITEMS };
      if (op.table === "orders" && op.action === "update") {
        const payload = op.payload as Record<string, unknown>;
        if ("holds_released_at" in payload) {
          // Compare-and-set on the marker: release claims it while null; re-apply
          // claims it while set.
          const claimingRelease = payload.holds_released_at !== null;
          if (claimingRelease === (marker === null)) {
            marker = claimingRelease ? String(payload.holds_released_at) : null;
            return { data: [{ id: "ord-1", customer_id: "cust-1", coupon_code: "HARVEST10" }] };
          }
          return { data: [] };
        }
      }
      return undefined;
    },
    orderRow({ coupon_code: "HARVEST10" }),
    rpc,
  );
}

describe("releaseOrderHolds — an unpaid online order gives back what it held", () => {
  it("releases stock, the coupon use and the burned points, once", async () => {
    vi.mocked(rewards.removeCouponUsesForOrder).mockResolvedValue(1);
    vi.mocked(rewards.releaseRedeemedPoints).mockResolvedValue(300);
    const fake = holdsDb();

    expect(await releaseOrderHolds("ord-1")).toBe(true);

    // Stock: the reservation is released per variant line (product-only skipped).
    expect(fake.rpcCalls).toEqual([
      {
        name: "release_variant_stock",
        args: {
          p_items: [
            { variant_id: "var-1", qty: 2 },
            { variant_id: "var-2", qty: 1 },
          ],
        },
      },
    ]);
    expect(rewards.removeCouponUsesForOrder).toHaveBeenCalledWith("ord-1");
    expect(rewards.releaseRedeemedPoints).toHaveBeenCalledWith("cust-1", "ord-1");
  });

  it("claims the 'released' marker with a compare-and-set before touching anything", async () => {
    const fake = holdsDb();

    await releaseOrderHolds("ord-1");

    const claim = updatesTo(fake.ops, "orders")[0];
    expect(claim.payload).toEqual({ holds_released_at: expect.any(String) });
    expect(filterOn(claim, "id", "eq")?.value).toBe("ord-1");
    expect(filterOn(claim, "holds_released_at", "is")?.value).toBeNull();
  });

  it("only ever releases a FAILED ONLINE order - never a COD, pending or paid one", async () => {
    const fake = holdsDb();

    await releaseOrderHolds("ord-1");

    const claim = updatesTo(fake.ops, "orders")[0];
    expect(filterOn(claim, "payment_method", "eq")?.value).toBe("upi");
    expect(filterOn(claim, "payment_status", "eq")?.value).toBe("failed");
  });

  it("is a no-op the second time: stock is never released twice", async () => {
    vi.mocked(rewards.removeCouponUsesForOrder).mockResolvedValue(0);
    vi.mocked(rewards.releaseRedeemedPoints).mockResolvedValue(0);
    const fake = holdsDb();

    expect(await releaseOrderHolds("ord-1")).toBe(true);
    expect(await releaseOrderHolds("ord-1")).toBe(false);

    expect(fake.rpcCalls).toHaveLength(1);
    expect(rewards.removeCouponUsesForOrder).toHaveBeenCalledTimes(1);
  });

  it("releases nothing, and does not throw, if the marker cannot be claimed (migration not applied)", async () => {
    const fake = holdsDb((op) =>
      op.table === "orders" && op.action === "update"
        ? { error: { message: 'column "holds_released_at" does not exist', code: "42703" } }
        : undefined,
    );

    await expect(releaseOrderHolds("ord-1")).resolves.toBe(false);

    expect(fake.rpcCalls).toHaveLength(0);
    expect(rewards.removeCouponUsesForOrder).not.toHaveBeenCalled();
    expect(rewards.releaseRedeemedPoints).not.toHaveBeenCalled();
  });

  it("still gives back the coupon and points if the stock release fails", async () => {
    vi.mocked(rewards.removeCouponUsesForOrder).mockResolvedValue(1);
    vi.mocked(rewards.releaseRedeemedPoints).mockResolvedValue(300);
    holdsDb(undefined, (name) =>
      name === "release_variant_stock" ? { error: { message: "rpc down" } } : undefined,
    );

    await expect(releaseOrderHolds("ord-1")).resolves.toBe(true);

    expect(rewards.removeCouponUsesForOrder).toHaveBeenCalled();
    expect(rewards.releaseRedeemedPoints).toHaveBeenCalled();
  });

  it("skips the rpc for an order with no variant lines", async () => {
    const fake = holdsDb((op) =>
      op.table === "order_items" && op.action === "select"
        ? { data: [{ variant_id: null, qty: 1 }] }
        : undefined,
    );

    await releaseOrderHolds("ord-1");

    expect(fake.rpcCalls).toHaveLength(0);
  });
});

describe("failUnpaidOnlineOrder", () => {
  it("fails a pending online order and releases its holds", async () => {
    vi.mocked(rewards.releaseRedeemedPoints).mockResolvedValue(0);
    const fake = holdsDb((op) =>
      op.table === "orders" &&
      op.action === "update" &&
      (op.payload as Record<string, unknown>).payment_status === "failed"
        ? { data: [{ id: "ord-1" }] }
        : undefined,
    );

    const won = await failUnpaidOnlineOrder("ord-1", "SBI-REF-1");

    expect(won).not.toBeNull();
    const [transition] = updatesTo(fake.ops, "orders");
    expect(transition.payload).toMatchObject({ payment_status: "failed", payment_ref: "SBI-REF-1" });
    expect(filterOn(transition, "payment_status")?.value).toEqual(["pending"]);
    expect(fake.rpcCalls.map((c) => c.name)).toEqual(["release_variant_stock"]);
  });

  it("releases nothing when another request already settled the order (it lost the race)", async () => {
    const fake = holdsDb((op) =>
      op.table === "orders" &&
      op.action === "update" &&
      (op.payload as Record<string, unknown>).payment_status === "failed"
        ? { data: [] }
        : undefined,
    );

    expect(await failUnpaidOnlineOrder("ord-1")).toBeNull();
    expect(fake.rpcCalls).toHaveLength(0);
    expect(rewards.removeCouponUsesForOrder).not.toHaveBeenCalled();
  });

  it("never throws: a failure while releasing must not mask the original error", async () => {
    vi.mocked(rewards.removeCouponUsesForOrder).mockRejectedValue(new Error("db down"));
    vi.mocked(rewards.releaseRedeemedPoints).mockRejectedValue(new Error("db down"));
    holdsDb((op) =>
      op.table === "orders" &&
      op.action === "update" &&
      (op.payload as Record<string, unknown>).payment_status === "failed"
        ? { data: [{ id: "ord-1" }] }
        : undefined,
    );

    await expect(failUnpaidOnlineOrder("ord-1")).resolves.not.toBeNull();
  });
});

describe("reapplyOrderHolds — an order released as unpaid turns out to be paid", () => {
  it("takes the stock, coupon use and points again", async () => {
    vi.mocked(rewards.reburnReleasedPoints).mockResolvedValue(300);
    const fake = holdsDb(undefined, undefined, true);

    expect(await reapplyOrderHolds("ord-1")).toBe(true);

    expect(fake.rpcCalls).toEqual([
      {
        name: "reserve_variant_stock",
        args: {
          p_items: [
            { variant_id: "var-1", qty: 2 },
            { variant_id: "var-2", qty: 1 },
          ],
        },
      },
    ]);
    expect(rewards.recordCouponUse).toHaveBeenCalledWith("HARVEST10", "cust-1", "ord-1");
    expect(rewards.reburnReleasedPoints).toHaveBeenCalledWith("cust-1", "ord-1");
  });

  it("clears the marker with a compare-and-set, scoped to a paid online order that was released", async () => {
    const fake = holdsDb(undefined, undefined, true);

    await reapplyOrderHolds("ord-1");

    const claim = updatesTo(fake.ops, "orders")[0];
    expect(claim.payload).toEqual({ holds_released_at: null });
    expect(filterOn(claim, "payment_status", "eq")?.value).toBe("paid");
    expect(filterOn(claim, "payment_method", "eq")?.value).toBe("upi");
    expect(filterOn(claim, "holds_released_at", "not")).toBeDefined();
  });

  it("does nothing for an order that was never released (failed earlier, still holds everything)", async () => {
    // Reserving again would hold the stock twice. This is the population the
    // recovery exists for: orders a callback marked failed before releases existed.
    const fake = holdsDb(undefined, undefined, false);

    expect(await reapplyOrderHolds("ord-1")).toBe(false);

    expect(fake.rpcCalls).toHaveLength(0);
    expect(rewards.recordCouponUse).not.toHaveBeenCalled();
    expect(rewards.reburnReleasedPoints).not.toHaveBeenCalled();
  });

  it("is once-only: a second call finds the marker already cleared", async () => {
    const fake = holdsDb(undefined, undefined, true);

    expect(await reapplyOrderHolds("ord-1")).toBe(true);
    expect(await reapplyOrderHolds("ord-1")).toBe(false);

    expect(fake.rpcCalls).toHaveLength(1);
  });

  it("still records the coupon and points if the stock has since sold out (the customer has paid)", async () => {
    const fake = holdsDb(
      undefined,
      (name) =>
        name === "reserve_variant_stock"
          ? { error: { message: "out_of_stock:var-1", code: "P0001" } }
          : undefined,
      true,
    );

    await expect(reapplyOrderHolds("ord-1")).resolves.toBe(true);

    expect(fake.rpcCalls).toHaveLength(1);
    expect(rewards.recordCouponUse).toHaveBeenCalled();
    expect(rewards.reburnReleasedPoints).toHaveBeenCalled();
    // An oversold paid order is something a human must see.
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("ord-1"));
  });
});

describe("onOnlineOrderPaid — what a confirmed online payment triggers", () => {
  const paid = { id: "ord-1", customerId: "cust-1", totalPaise: 220_000 };

  it("credits the loyalty points the order earns, now that it is paid", async () => {
    vi.mocked(rewards.earnPointsForOrder).mockResolvedValue(2200);
    holdsDb();

    await onOnlineOrderPaid(paid);

    expect(rewards.earnPointsForOrder).toHaveBeenCalledWith("cust-1", "ord-1", 220_000);
  });

  it("re-takes the holds first when the order had been released", async () => {
    vi.mocked(rewards.earnPointsForOrder).mockResolvedValue(2200);
    const fake = holdsDb(undefined, undefined, true);

    await onOnlineOrderPaid(paid);

    expect(fake.rpcCalls.map((c) => c.name)).toEqual(["reserve_variant_stock"]);
  });

  it("earns nothing for a guest order", async () => {
    holdsDb();

    await onOnlineOrderPaid({ ...paid, customerId: null });

    expect(rewards.earnPointsForOrder).not.toHaveBeenCalled();
  });

  it("never throws - a bookkeeping failure must not undo a confirmed payment", async () => {
    vi.mocked(rewards.earnPointsForOrder).mockRejectedValue(new Error("db down"));
    vi.mocked(rewards.reburnReleasedPoints).mockRejectedValue(new Error("db down"));
    holdsDb(undefined, undefined, true);

    await expect(onOnlineOrderPaid(paid)).resolves.toBeUndefined();
  });
});

describe("createOrder — loyalty points are earned when an online order is PAID, not placed", () => {
  const RULES = {
    shippingType: "zero",
    freeDeliveryThresholdPaise: 0,
    shippingSlabs: [],
    shippingFlatPaise: 0,
    taxMode: "inclusive",
    taxRateBps: 0,
    currency: "INR",
  };

  /** A database that can place one order for one variant priced at Rs 1,000. */
  function placeDb() {
    return installDb((op) => {
      if (op.table === "product_variants") return { data: [{ id: "var-1", price_paise: 100_000 }] };
      if (op.table === "products") return { data: [] };
      if (op.table === "orders" && op.action === "insert") {
        const payload = op.payload as Record<string, unknown>;
        return {
          data: orderRow({
            payment_method: payload.payment_method,
            total_paise: payload.total_paise,
            coupon_code: payload.coupon_code,
            loyalty_redeemed_paise: payload.loyalty_redeemed_paise,
          }),
        };
      }
      if (op.table === "orders" && op.action === "select") return { data: null };
      if (op.table === "order_items" || op.table === "order_status_events") return { data: [] };
      return undefined;
    });
  }

  const input = {
    customerId: "cust-1",
    items: [{ productId: "p1", variantId: "var-1", title: "A2 Ghee", qty: 1 }],
    couponCode: "HARVEST10",
    loyaltyPoints: 300,
  };

  beforeEach(() => {
    vi.mocked(getCommerceRules).mockResolvedValue(RULES as never);
    vi.mocked(getActivePromotions).mockResolvedValue([]);
    vi.mocked(rewards.validateCouponServer).mockResolvedValue({
      valid: true,
      discountPaise: 10_000,
      reason: null,
      coupon: { code: "HARVEST10" },
    } as never);
    vi.mocked(rewards.quoteLoyaltyRedemption).mockResolvedValue({ points: 300, discountPaise: 3_000 });
    vi.mocked(rewards.redeemPoints).mockResolvedValue({ points: 300, discountPaise: 3_000 });
    vi.mocked(rewards.earnPointsForOrder).mockResolvedValue(870);
    vi.mocked(rewards.recordCouponUse).mockResolvedValue(undefined);
  });

  it("does not credit earn points when an ONLINE order is created", async () => {
    placeDb();

    await createOrder({ ...input, paymentMethod: "upi" });

    expect(rewards.earnPointsForOrder).not.toHaveBeenCalled();
  });

  it("still takes the coupon and burns the points at creation for an online order (they are holds)", async () => {
    placeDb();

    await createOrder({ ...input, paymentMethod: "upi" });

    expect(rewards.recordCouponUse).toHaveBeenCalledTimes(1);
    expect(rewards.redeemPoints).toHaveBeenCalledTimes(1);
  });

  it("credits earn points at creation for COD, as before", async () => {
    placeDb();

    await createOrder({ ...input, paymentMethod: "cod" });

    expect(rewards.earnPointsForOrder).toHaveBeenCalledTimes(1);
    expect(rewards.earnPointsForOrder).toHaveBeenCalledWith("cust-1", "ord-1", 87_000);
  });
});
