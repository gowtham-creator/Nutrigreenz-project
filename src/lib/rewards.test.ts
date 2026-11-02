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
vi.mock("@/lib/customer-identity", () => ({
  hasVerifiedPhone: vi.fn(),
  verifiedPhonesOf: vi.fn(),
}));
vi.mock("@/lib/commerce-rules", () => ({ communitiesForPincode: vi.fn() }));

import { communitiesForPincode } from "@/lib/commerce-rules";
import { couponEndInstant, couponStartInstant } from "@/lib/coupon-dates";
import { verifiedPhonesOf } from "@/lib/customer-identity";
import {
  couponAudiencePhones,
  createCoupon,
  earnPointsForOrder,
  getCoupon,
  releaseRedeemedPoints,
  reburnReleasedPoints,
  removeCouponUsesForOrder,
  revokeEarnedPoints,
  updateCoupon,
  validateCouponServer,
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

const COUPON_ROW = {
  id: "coupon-1",
  code: "VIP20",
  kind: "percent",
  value: 20,
  min_order_paise: 0,
  cap_paise: null,
  active: true,
  starts_at: null,
  ends_at: null,
  usage_limit: null,
  per_customer_limit: null,
  requires_verified_phone: false,
  pincodes: null,
  communities: null,
  product_ids: null,
  customer_phones: null,
  stack_loyalty: true,
  description: null,
  used_count: 0,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

/** A database holding one coupon. */
const useCoupon = (overrides: Record<string, unknown> = {}) =>
  useDb((op) =>
    op.table === "coupons" ? { data: [{ ...COUPON_ROW, ...overrides }] } : undefined,
  );

describe("validateCouponServer — named customers", () => {
  const LISTED = "+919876543210";

  it("applies for a customer who has verified a listed number", async () => {
    useCoupon({ customer_phones: [LISTED] });
    vi.mocked(verifiedPhonesOf).mockResolvedValue([LISTED]);

    const result = await validateCouponServer("VIP20", 100_000, "cust-1");

    expect(result.valid).toBe(true);
    expect(result.discountPaise).toBe(20_000);
  });

  it("matches any of a customer's verified numbers", async () => {
    useCoupon({ customer_phones: [LISTED] });
    vi.mocked(verifiedPhonesOf).mockResolvedValue(["+919000000000", LISTED]);

    expect((await validateCouponServer("VIP20", 100_000, "cust-1")).valid).toBe(true);
  });

  it("refuses a verified customer who isn't listed, and gives no discount", async () => {
    useCoupon({ customer_phones: [LISTED] });
    vi.mocked(verifiedPhonesOf).mockResolvedValue(["+919000000000"]);

    const result = await validateCouponServer("VIP20", 100_000, "cust-2");

    expect(result).toMatchObject({ valid: false, reason: "customer-not-eligible", discountPaise: 0 });
    expect(result.coupon).toBeNull();
  });

  it("asks for an OTP when the customer has no verified phone", async () => {
    useCoupon({ customer_phones: [LISTED] });
    vi.mocked(verifiedPhonesOf).mockResolvedValue([]);

    const result = await validateCouponServer("VIP20", 100_000, "cust-3");

    expect(result.reason).toBe("phone-verification-required");
  });

  it("fails closed with no customer at all", async () => {
    useCoupon({ customer_phones: [LISTED] });

    const result = await validateCouponServer("VIP20", 100_000, null);

    expect(result).toMatchObject({ valid: false, reason: "phone-verification-required" });
    expect(verifiedPhonesOf).not.toHaveBeenCalled();
  });

  it("refuses a stranger ahead of the cart minimum, so they are never nudged to spend more", async () => {
    useCoupon({ customer_phones: [LISTED], min_order_paise: 59_900 });
    vi.mocked(verifiedPhonesOf).mockResolvedValue(["+919000000000"]);

    const result = await validateCouponServer("VIP20", 100, "cust-2");

    expect(result.reason).toBe("customer-not-eligible");
  });

  it("does not look up phones for a coupon open to anyone", async () => {
    useCoupon();

    expect((await validateCouponServer("VIP20", 100_000, "cust-1")).valid).toBe(true);
    expect(verifiedPhonesOf).not.toHaveBeenCalled();
  });
});

describe("validateCouponServer — validity window", () => {
  const window = {
    starts_at: couponStartInstant("2026-11-05"),
    ends_at: couponEndInstant("2026-11-05"),
  };
  const at = (iso: string) => ({ now: new Date(iso) });

  it("is not open the evening before, by India time", async () => {
    useCoupon(window);

    const result = await validateCouponServer("VIP20", 100_000, null, at("2026-11-04T23:59:00+05:30"));

    expect(result.reason).toBe("not-started");
  });

  it("still works at 11:59 PM on its last day, not just until 5:30 AM", async () => {
    useCoupon(window);

    expect(
      (await validateCouponServer("VIP20", 100_000, null, at("2026-11-05T23:59:00+05:30"))).valid,
    ).toBe(true);
  });

  it("has expired at midnight after its last day", async () => {
    useCoupon(window);

    const result = await validateCouponServer("VIP20", 100_000, null, at("2026-11-06T00:00:00+05:30"));

    expect(result.reason).toBe("expired");
  });
});

describe("validateCouponServer — gated communities", () => {
  const PLACES = "SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana, India";

  beforeEach(() => {
    // Production has no community rows, so the address is the usual way to pass.
    vi.mocked(communitiesForPincode).mockResolvedValue([]);
  });

  describe("by the delivery address", () => {
    it("applies when the address names the community", async () => {
      useCoupon({ communities: [PLACES], pincodes: ["500075"] });

      const result = await validateCouponServer("VIP20", 100_000, null, {
        pincode: "500075",
        addressText: "Flat 402, SAS Crown, Kokapet",
      });

      expect(result.valid).toBe(true);
    });

    it("needs no serviceable_areas lookup once the address matches", async () => {
      useCoupon({ communities: [PLACES], pincodes: ["500075"] });

      await validateCouponServer("VIP20", 100_000, null, {
        pincode: "500075",
        addressText: "SAS Crown",
      });

      expect(communitiesForPincode).not.toHaveBeenCalled();
    });

    it("refuses an address that names somewhere else", async () => {
      useCoupon({ communities: [PLACES], pincodes: ["500075"] });

      const result = await validateCouponServer("VIP20", 100_000, null, {
        pincode: "500075",
        addressText: "Flat 12, My Home Avatar, Kokapet",
      });

      expect(result).toMatchObject({ valid: false, reason: "area-not-eligible", discountPaise: 0 });
    });

    it("refuses the same society name in a different pincode", async () => {
      useCoupon({
        communities: ["Green Park, Begumpet, Hyderabad, Telangana, India"],
        pincodes: ["500016"],
      });

      const result = await validateCouponServer("VIP20", 100_000, null, {
        pincode: "110016",
        addressText: "House 9, Green Park, New Delhi",
      });

      expect(result.reason).toBe("area-not-eligible");
    });

    it("applies a free-typed community, which carries no pincode of its own", async () => {
      useCoupon({ communities: ["Aparna Sarovar"], pincodes: null });

      const result = await validateCouponServer("VIP20", 100_000, null, {
        pincode: "500019",
        addressText: "C-204, Aparna Sarovar, Nallagandla",
      });

      expect(result.valid).toBe(true);
    });

    it("fails closed with an empty address and no delivery-list match", async () => {
      useCoupon({ communities: [PLACES], pincodes: ["500075"] });

      for (const addressText of ["", "   ", null, undefined]) {
        const result = await validateCouponServer("VIP20", 100_000, null, {
          pincode: "500075",
          addressText,
        });
        expect(result.reason).toBe("area-not-eligible");
      }
    });

    it("still needs a delivery pincode", async () => {
      useCoupon({ communities: ["Aparna Sarovar"] });

      const result = await validateCouponServer("VIP20", 100_000, null, {
        addressText: "Aparna Sarovar",
      });

      expect(result.reason).toBe("area-not-eligible");
    });
  });

  describe("by serviceable_areas, the second way to pass", () => {
    it("applies when the list names the community, with no address at all", async () => {
      useCoupon({ communities: [PLACES] });
      vi.mocked(communitiesForPincode).mockResolvedValue(["SAS Crown"]);

      const result = await validateCouponServer("VIP20", 100_000, null, { pincode: "500075" });

      expect(result.valid).toBe(true);
    });

    it("refuses a different community at the same pincode", async () => {
      useCoupon({ communities: [PLACES] });
      vi.mocked(communitiesForPincode).mockResolvedValue(["My Home Avatar"]);

      const result = await validateCouponServer("VIP20", 100_000, null, { pincode: "500075" });

      expect(result.reason).toBe("area-not-eligible");
    });
  });
});

describe("coupon columns", () => {
  it("reads the new columns back", async () => {
    useCoupon({
      customer_phones: ["+919876543210"],
      stack_loyalty: false,
      description: "  ₹50 off for you  ",
    });

    expect(await getCoupon("VIP20")).toMatchObject({
      customerPhones: ["+919876543210"],
      stackLoyalty: false,
      description: "₹50 off for you",
    });
  });

  it("selects them", async () => {
    const fake = useCoupon();

    await getCoupon("VIP20");

    const columns = fake.ops.find((o) => o.table === "coupons")?.columns ?? "";
    expect(columns).toContain("customer_phones");
    expect(columns).toContain("stack_loyalty");
    expect(columns).toContain("description");
  });

  it("treats an unset stacking value as stacking, and an empty list as anyone", async () => {
    useCoupon({ stack_loyalty: null, customer_phones: [] });

    expect(await getCoupon("VIP20")).toMatchObject({ stackLoyalty: true, customerPhones: null });
  });

  it("stacks by default on create, so a new coupon behaves as coupons always have", async () => {
    const fake = useCoupon();

    await createCoupon({ code: "vip20", kind: "percent", value: 20 });

    expect(inserts(fake.ops, "coupons")[0]).toMatchObject({
      code: "VIP20",
      customer_phones: null,
      stack_loyalty: true,
      description: null,
    });
  });

  it("writes them on create", async () => {
    const fake = useCoupon();

    await createCoupon({
      code: "VIP20",
      kind: "percent",
      value: 20,
      customerPhones: ["+919876543210"],
      stackLoyalty: false,
      description: "For you",
    });

    expect(inserts(fake.ops, "coupons")[0]).toMatchObject({
      customer_phones: ["+919876543210"],
      stack_loyalty: false,
      description: "For you",
    });
  });

  it("patches them, and clears the list and description with null", async () => {
    const fake = useCoupon();

    await updateCoupon("coupon-1", { customerPhones: null, stackLoyalty: false, description: null });

    const update = fake.ops.find((o) => o.table === "coupons" && o.action === "update");
    expect(update?.payload).toEqual({
      customer_phones: null,
      stack_loyalty: false,
      description: null,
    });
  });

  it("leaves them alone when a patch doesn't mention them", async () => {
    const fake = useCoupon();

    await updateCoupon("coupon-1", { active: false });

    const update = fake.ops.find((o) => o.table === "coupons" && o.action === "update");
    expect(update?.payload).toEqual({ active: false });
  });
});

describe("couponAudiencePhones", () => {
  it("gives a customer-targeted code's numbers", async () => {
    useCoupon({ customer_phones: ["+919876543210"] });

    expect(await couponAudiencePhones("vip20")).toEqual(["+919876543210"]);
  });

  it("is null for a code open to anyone, and for a key that isn't a code", async () => {
    useCoupon();
    expect(await couponAudiencePhones("VIP20")).toBeNull();

    useDb(() => ({ data: null }));
    expect(await couponAudiencePhones("DIWALI-NEWSLETTER")).toBeNull();
  });

  it("throws when the lookup fails, because no answer must not read as everyone", async () => {
    useDb(() => ({ error: { message: "connection reset" } }));

    await expect(couponAudiencePhones("VIP20")).rejects.toThrow("connection reset");
  });
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

describe("revokeEarnedPoints — a cancelled order's earned points", () => {
  /** This order's earn and cancel rows, then the customer's live balance. */
  const useLedger = (orderRows: { delta_points: number }[], balance: number) =>
    useDb((op) => {
      if (op.table !== "loyalty_ledger" || op.action !== "select") return undefined;
      return filterOn(op, "order_id") ? { data: orderRows } : { data: [{ delta_points: balance }] };
    });

  it("takes back what the order earned, as an order_cancel row", async () => {
    const fake = useLedger([{ delta_points: 220 }], 1000);

    expect(await revokeEarnedPoints("cust-1", "ord-1")).toBe(220);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([
      { customer_id: "cust-1", order_id: "ord-1", delta_points: -220, reason: "order_cancel" },
    ]);
    // Reads only earn and cancel rows, so a redeemed-points give-back can't skew it.
    const read = fake.ops.find((o) => o.table === "loyalty_ledger" && filterOn(o, "order_id"));
    expect(filterOn(read!, "reason", "in")?.value).toEqual(["order_earn", "order_cancel"]);
  });

  it("is idempotent: a second cancel takes nothing more", async () => {
    const fake = useLedger([{ delta_points: 220 }, { delta_points: -220 }], 1000);

    expect(await revokeEarnedPoints("cust-1", "ord-1")).toBe(0);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([]);
  });

  it("never drives the balance negative: points already spent stay spent", async () => {
    const fake = useLedger([{ delta_points: 220 }], 50);

    expect(await revokeEarnedPoints("cust-1", "ord-1")).toBe(50);
    expect(inserts(fake.ops, "loyalty_ledger")).toEqual([
      { customer_id: "cust-1", order_id: "ord-1", delta_points: -50, reason: "order_cancel" },
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
