/**
 * Checkout's loyalty maths: what the rewards switch offers, and what the server
 * will actually take.
 *
 * `quoteLoyalty` restates `quoteLoyaltyRedemption` because `lib/rewards.ts` is
 * server-only. A restatement can drift, and drift is exactly how the switch came
 * to do nothing on a ₹1 order, so the parity block below runs the REAL server
 * functions over the same inputs rather than trusting hand-worked numbers alone.
 */
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));
vi.mock("@/lib/customer-identity", () => ({ hasVerifiedPhone: vi.fn() }));
vi.mock("@/lib/commerce-rules", () => ({ communitiesForPincode: vi.fn() }));

import { earnPointsForOrder, quoteLoyaltyRedemption } from "@/lib/rewards";
import {
  INR,
  INRExact,
  loyaltyBlockMessage,
  pointsEarned,
  quoteLoyalty,
  type LoyaltyRedeemRules,
} from "./order-math";

/** The live programme: 10 points = ₹1, 100 to start, up to 20% of the subtotal. */
const LIVE: LoyaltyRedeemRules = {
  redeemPointsPerRupee: 10,
  minRedeemPoints: 100,
  maxRedeemPercent: 20,
};

const quote = (
  balance: number,
  subtotalPaise: number,
  couponDiscountPaise = 0,
  config: LoyaltyRedeemRules = LIVE,
) => quoteLoyalty({ balance, subtotalPaise, couponDiscountPaise, config });

describe("quoteLoyalty — what an order can take", () => {
  it("redeems on a ₹1 order, where the limit is under a rupee", () => {
    // 20% of ₹1 is 20 paise: 2 points. Whole-rupee maths floored this to nothing.
    expect(quote(500, 100)).toEqual({ points: 2, discountPaise: 20, blocked: null });
  });

  it("takes only what the percentage allows, not the whole balance", () => {
    expect(quote(5000, 100_000)).toEqual({ points: 2000, discountPaise: 20_000, blocked: null });
  });

  it("stops at the balance when that is smaller than the limit", () => {
    expect(quote(150, 100_000)).toEqual({ points: 150, discountPaise: 1500, blocked: null });
  });

  it("allows a balance of exactly the minimum", () => {
    expect(quote(100, 100_000).blocked).toBeNull();
  });

  it("leaves the coupon its headroom when it has taken more than the percentage leaves", () => {
    // ₹100 order, ₹90 coupon: 20% would allow ₹20, but only ₹10 is left.
    expect(quote(5000, 10_000, 9000)).toEqual({ points: 100, discountPaise: 1000, blocked: null });
  });

  it("is unaffected by a coupon that leaves more than the percentage needs", () => {
    expect(quote(5000, 10_000, 1000)).toEqual({ points: 200, discountPaise: 2000, blocked: null });
  });

  it.each([
    // 100 / 3 is 33.3: a point is worth 33 paise, never a fraction of one.
    [3, 33, 606, 19_998],
    // 100 / 7 is 14.3.
    [7, 14, 1428, 19_992],
    // 100 / 6 is 16.7, which rounds UP to 17.
    [6, 17, 1176, 19_992],
  ])(
    "uses whole paise per point when %i points to the rupee doesn't divide 100",
    (redeemPointsPerRupee, paisePerPoint, points, discountPaise) => {
      expect(quote(1_000_000, 100_000, 0, { ...LIVE, redeemPointsPerRupee })).toEqual({
        points,
        discountPaise,
        blocked: null,
      });
      expect(discountPaise).toBe(points * paisePerPoint);
    },
  );

  it("never values a point at nothing, however many make a rupee", () => {
    // 100 / 300 rounds to 0; the floor of one paise keeps the division real.
    expect(quote(1000, 100, 0, { ...LIVE, redeemPointsPerRupee: 300 })).toEqual({
      points: 20,
      discountPaise: 20,
      blocked: null,
    });
  });

  it("falls back to the default ratio rather than dividing by zero", () => {
    expect(quote(500, 100, 0, { ...LIVE, redeemPointsPerRupee: 0 }).points).toBe(2);
  });
});

describe("quoteLoyalty — why it can't", () => {
  it("reports no balance ahead of the minimum", () => {
    expect(quote(0, 100_000)).toEqual({ points: 0, discountPaise: 0, blocked: "no-balance" });
  });

  it("reports a balance below the minimum", () => {
    expect(quote(40, 100_000)).toEqual({ points: 0, discountPaise: 0, blocked: "below-minimum" });
    expect(quote(99, 100_000).blocked).toBe("below-minimum");
  });

  it("reports an order whose limit is worth less than one point", () => {
    // At 1 point = ₹1, the 20 paise a ₹1 order allows doesn't reach one point.
    expect(quote(500, 100, 0, { ...LIVE, redeemPointsPerRupee: 1 })).toEqual({
      points: 0,
      discountPaise: 0,
      blocked: "order-too-small",
    });
  });

  it("calls a tiny order too small even with a coupon on it", () => {
    // Taking the coupon off wouldn't help, so the coupon isn't what to blame.
    expect(quote(500, 100, 100, { ...LIVE, redeemPointsPerRupee: 1 }).blocked).toBe(
      "order-too-small",
    );
  });

  it.each([
    ["all of it", 10_000],
    ["all but less than one point's worth", 9995],
    ["more than the subtotal", 12_000],
  ])("reports a coupon that took %s", (_label, couponDiscountPaise) => {
    expect(quote(5000, 10_000, couponDiscountPaise)).toEqual({
      points: 0,
      discountPaise: 0,
      blocked: "coupon-covers-order",
    });
  });
});

describe("quoteLoyalty — a coupon that doesn't stack", () => {
  const blocked = (balance: number, subtotalPaise: number, config = LIVE, couponDiscountPaise = 1000) =>
    quoteLoyalty({ balance, subtotalPaise, couponDiscountPaise, couponBlocksLoyalty: true, config });

  it("takes nothing, as the create-order path won't", () => {
    expect(blocked(5000, 100_000)).toEqual({ points: 0, discountPaise: 0, blocked: "coupon-no-stack" });
  });

  it("redeems as normal once the coupon stops blocking", () => {
    expect(
      quoteLoyalty({
        balance: 5000,
        subtotalPaise: 100_000,
        couponDiscountPaise: 1000,
        couponBlocksLoyalty: false,
        config: LIVE,
      }).blocked,
    ).toBeNull();
  });

  it("names the coupon rather than the headroom when it also covers the order", () => {
    expect(blocked(5000, 10_000, LIVE, 10_000).blocked).toBe("coupon-no-stack");
  });

  it.each([
    ["there are no points", 0, 100_000, LIVE, "no-balance"],
    ["the balance is under the minimum", 40, 100_000, LIVE, "below-minimum"],
    ["the order is too small", 500, 100, { ...LIVE, redeemPointsPerRupee: 1 }, "order-too-small"],
  ])("doesn't blame the coupon when %s: removing it wouldn't help", (_label, balance, subtotal, config, reason) => {
    expect(blocked(balance, subtotal, config).blocked).toBe(reason);
  });
});

describe("loyaltyBlockMessage", () => {
  it("says what is needed and what the customer has", () => {
    expect(loyaltyBlockMessage("below-minimum", 40, LIVE)).toBe(
      "You need 100 points to redeem. You have 40.",
    );
  });

  it("has a sentence for every reason", () => {
    for (const block of [
      "no-balance",
      "below-minimum",
      "order-too-small",
      "coupon-covers-order",
      "coupon-no-stack",
    ] as const) {
      expect(loyaltyBlockMessage(block, 40, LIVE).length).toBeGreaterThan(0);
    }
  });

  it("says plainly that the coupon is what's in the way", () => {
    expect(loyaltyBlockMessage("coupon-no-stack", 500, LIVE)).toBe(
      "This coupon can't be combined with points. Remove it to use them.",
    );
  });
});

describe("pointsEarned", () => {
  const on = { earnEnabled: true, earnPointsPerRupee: 1 };

  it("earns on the paise total at the configured rate, rounded down", () => {
    expect(pointsEarned(12_345, on)).toBe(123);
    expect(pointsEarned(12_345, { ...on, earnPointsPerRupee: 2 })).toBe(246);
  });

  it("is not the old flat one point per ₹10", () => {
    expect(pointsEarned(100_000, on)).toBe(1000);
  });

  it("earns nothing on an order under a rupee", () => {
    expect(pointsEarned(80, on)).toBe(0);
  });

  it("earns nothing while earning is switched off", () => {
    expect(pointsEarned(100_000, { ...on, earnEnabled: false })).toBe(0);
  });
});

describe("INRExact", () => {
  it.each([
    [0.2, "₹0.20"],
    [0.8, "₹0.80"],
    [40.8, "₹40.80"],
    [1234.5, "₹1,234.50"],
  ])("keeps the paise of %f", (value, shown) => {
    expect(INRExact(value)).toBe(shown);
  });

  it.each([
    [0, "₹0"],
    [1, "₹1"],
    [1200, "₹1,200"],
  ])("leaves a whole-rupee %f looking the way INR does", (value, shown) => {
    expect(INRExact(value)).toBe(shown);
    expect(INRExact(value)).toBe(INR(value));
  });

  it("doesn't show binary floating-point noise", () => {
    expect(1.1 - 0.2).not.toBe(0.9);
    expect(INRExact(1.1 - 0.2)).toBe("₹0.90");
  });
});

describe("the client maths matches the server's", () => {
  function seedProgramme(balance: number, config: LoyaltyRedeemRules, earnPointsPerRupee = 1) {
    h.db = createFakeSupabase((op) => {
      if (op.table === "loyalty_config") {
        return {
          data: {
            earn_points_per_rupee: earnPointsPerRupee,
            redeem_points_per_rupee: config.redeemPointsPerRupee,
            min_redeem_points: config.minRedeemPoints,
            max_redeem_percent: config.maxRedeemPercent,
            expiry_months: 12,
            earn_enabled: true,
          },
        };
      }
      if (op.table === "loyalty_ledger" && op.action === "select") {
        // Read twice over: the balance, and earn's has-this-order-earned guard.
        return { data: op.columns === "delta_points" ? [{ delta_points: balance }] : [] };
      }
      return undefined;
    }).client;
  }

  const SUBTOTALS = [100, 250, 999, 9_999, 100_000];
  const BALANCES = [0, 1, 40, 99, 100, 500, 1_000_000];
  const PERCENTS = [0, 20, 100];
  const MINIMUMS = [0, 100];

  it.each([1, 2, 3, 6, 7, 10, 25, 150, 300])(
    "quotes the same as quoteLoyaltyRedemption at %i points to the rupee",
    async (redeemPointsPerRupee) => {
      for (const subtotalPaise of SUBTOTALS) {
        for (const couponDiscountPaise of [0, 50, 95, subtotalPaise]) {
          for (const balance of BALANCES) {
            for (const maxRedeemPercent of PERCENTS) {
              for (const minRedeemPoints of MINIMUMS) {
                const config = { redeemPointsPerRupee, minRedeemPoints, maxRedeemPercent };
                seedProgramme(balance, config);

                const client = quote(balance, subtotalPaise, couponDiscountPaise, config);
                const asked = { balance, subtotalPaise, couponDiscountPaise, ...config };
                // The most anyone could ask for: the server's own limits decide.
                const server = await quoteLoyaltyRedemption(
                  "cust-1",
                  balance,
                  subtotalPaise,
                  couponDiscountPaise,
                );
                expect({ ...asked, ...server }).toEqual({
                  ...asked,
                  points: client.points,
                  discountPaise: client.discountPaise,
                });

                // And the number checkout really sends must come back untouched.
                if (client.points > 0) {
                  const echoed = await quoteLoyaltyRedemption(
                    "cust-1",
                    client.points,
                    subtotalPaise,
                    couponDiscountPaise,
                  );
                  expect({ ...asked, ...echoed }).toEqual({
                    ...asked,
                    points: client.points,
                    discountPaise: client.discountPaise,
                  });
                }
              }
            }
          }
        }
      }
    },
  );

  it.each([
    [80, 1],
    [100, 1],
    [12_345, 1],
    [12_345, 2],
    [124_000, 3],
  ])("promises the points earnPointsForOrder credits on %i paise at rate %i", async (paise, rate) => {
    seedProgramme(0, LIVE, rate);

    expect(pointsEarned(paise, { earnEnabled: true, earnPointsPerRupee: rate })).toBe(
      await earnPointsForOrder("cust-1", "ord-1", paise),
    );
  });
});
