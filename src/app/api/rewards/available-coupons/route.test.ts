/**
 * The storefront coupon routes, run against the real validation.
 *
 * A code limited to named customers holds those customers' phone numbers, so what
 * matters here is that nobody else is offered it and no response ever carries the
 * list.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));
const m = vi.hoisted(() => ({
  getCustomerSession: vi.fn(),
  verifiedPhonesOf: vi.fn(),
  communitiesForPincode: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));
vi.mock("@/lib/customer-session", () => ({ getCustomerSession: m.getCustomerSession }));
vi.mock("@/lib/customer-identity", () => ({
  hasVerifiedPhone: vi.fn(),
  verifiedPhonesOf: m.verifiedPhonesOf,
}));
vi.mock("@/lib/commerce-rules", () => ({ communitiesForPincode: m.communitiesForPincode }));

import { POST as available } from "./route";
import { POST as validate } from "../validate-coupon/route";

const LISTED = "+919876543210";

const ROW = {
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
  customer_phones: [LISTED],
  stack_loyalty: true,
  description: null,
  used_count: 0,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

function useCoupon(overrides: Record<string, unknown> = {}) {
  const row = { ...ROW, ...overrides };
  h.db = createFakeSupabase((op) =>
    op.table === "coupons" ? { data: [row] } : undefined,
  ).client;
}

const post = (handler: (r: Request) => Promise<Response>, body: Record<string, unknown>) =>
  handler(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }));

interface Offers {
  eligible: { code: string }[];
  almostThere: { code: string }[];
}

const offers = async (body: Record<string, unknown> = { subtotalPaise: 100_000 }) =>
  (await (await post(available, body)).json()) as Offers;

beforeEach(() => {
  m.getCustomerSession.mockResolvedValue({ uid: "u", customerId: "cust-1" });
  m.communitiesForPincode.mockResolvedValue([]);
  useCoupon();
});

describe("POST /api/rewards/available-coupons", () => {
  it("offers a customer-targeted code to the customer it is for", async () => {
    m.verifiedPhonesOf.mockResolvedValue([LISTED]);

    expect((await offers()).eligible.map((c) => c.code)).toEqual(["VIP20"]);
  });

  it("doesn't offer it to a verified customer who isn't listed", async () => {
    m.verifiedPhonesOf.mockResolvedValue(["+919000000000"]);

    expect(await offers()).toEqual(expect.objectContaining({ eligible: [], almostThere: [] }));
  });

  it("doesn't offer it to a customer with no verified phone", async () => {
    m.verifiedPhonesOf.mockResolvedValue([]);

    expect(await offers()).toEqual(expect.objectContaining({ eligible: [], almostThere: [] }));
  });

  it("doesn't nudge a stranger to add to their cart for it", async () => {
    useCoupon({ min_order_paise: 59_900 });
    m.verifiedPhonesOf.mockResolvedValue(["+919000000000"]);

    expect((await offers({ subtotalPaise: 100 })).almostThere).toEqual([]);
  });

  it("does nudge the customer it is for", async () => {
    useCoupon({ min_order_paise: 59_900 });
    m.verifiedPhonesOf.mockResolvedValue([LISTED]);

    expect((await offers({ subtotalPaise: 100 })).almostThere.map((c) => c.code)).toEqual(["VIP20"]);
  });

  it("never sends the customer list to the browser", async () => {
    m.verifiedPhonesOf.mockResolvedValue([LISTED]);

    const text = await (await post(available, { subtotalPaise: 100_000 })).text();

    expect(text).not.toContain(LISTED);
    expect(text).not.toContain("customerPhones");
  });

  it("passes the previewed address through to the check", async () => {
    useCoupon({ customer_phones: null, communities: ["SAS Crown, Kokapet"] });

    const withAddress = await offers({
      subtotalPaise: 100_000,
      pincode: "500075",
      addressText: "Flat 402, SAS Crown",
    });
    const without = await offers({ subtotalPaise: 100_000, pincode: "500075" });

    expect(withAddress.eligible.map((c) => c.code)).toEqual(["VIP20"]);
    expect(without.eligible).toEqual([]);
  });

  it("is signed-in only", async () => {
    m.getCustomerSession.mockResolvedValue(null);

    expect((await post(available, { subtotalPaise: 100_000 })).status).toBe(401);
  });
});

describe("POST /api/rewards/validate-coupon", () => {
  const body = { code: "VIP20", subtotalPaise: 100_000 };
  const quote = async (extra: Record<string, unknown> = {}) =>
    (await (await post(validate, { ...body, ...extra })).json()) as Record<string, unknown>;

  it("names the new refusal for a verified customer who isn't listed", async () => {
    m.verifiedPhonesOf.mockResolvedValue(["+919000000000"]);

    expect(await quote()).toMatchObject({ valid: false, reason: "customer-not-eligible" });
  });

  it("asks an unverified customer for an OTP, which opens the inline flow", async () => {
    m.verifiedPhonesOf.mockResolvedValue([]);

    expect(await quote()).toMatchObject({ valid: false, reason: "phone-verification-required" });
  });

  it("reports that a coupon stacks with loyalty", async () => {
    m.verifiedPhonesOf.mockResolvedValue([LISTED]);

    expect(await quote()).toMatchObject({ valid: true, stacksWithLoyalty: true });
  });

  it("reports that a coupon doesn't", async () => {
    useCoupon({ stack_loyalty: false });
    m.verifiedPhonesOf.mockResolvedValue([LISTED]);

    expect(await quote()).toMatchObject({ valid: true, stacksWithLoyalty: false });
  });

  it("restricts nothing about loyalty when the code didn't apply", async () => {
    useCoupon({ stack_loyalty: false });
    m.verifiedPhonesOf.mockResolvedValue(["+919000000000"]);

    expect(await quote()).toMatchObject({ valid: false, stacksWithLoyalty: true });
  });

  it("matches a community against the previewed address", async () => {
    useCoupon({ customer_phones: null, communities: ["SAS Crown, Kokapet"] });

    expect(await quote({ pincode: "500075", addressText: "SAS Crown" })).toMatchObject({ valid: true });
    expect(await quote({ pincode: "500075", addressText: "Elsewhere" })).toMatchObject({
      valid: false,
      reason: "area-not-eligible",
    });
  });

  it("never sends the customer list to the browser", async () => {
    m.verifiedPhonesOf.mockResolvedValue([LISTED]);

    const text = await (await post(validate, body)).text();

    expect(text).not.toContain(LISTED);
  });
});
