/**
 * The serviceable-areas lookup, now that orders depend on it.
 *
 * The fake does not interpret filters, so each response is decided from the
 * filters the query carried: "any active row" versus "this pincode".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterOn, type FakeResult } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: () => h.db,
}));

import { DEFAULT_COMMERCE_RULES, getCommerceRules, isServiceable } from "@/lib/commerce-rules";

/** A database with `active` live areas, of which `matches` are this pincode. */
function areasDb(active: FakeResult, matches: FakeResult = { count: 0 }) {
  const fake = createFakeSupabase((op) => (filterOn(op, "pincode") ? matches : active));
  h.db = fake.client;
  return fake;
}

describe("getCommerceRules", () => {
  const rulesDb = (result: FakeResult) => {
    h.db = createFakeSupabase(() => result).client;
  };

  it("reads the live rules", async () => {
    rulesDb({
      data: {
        min_order_paise: 100,
        free_delivery_threshold_paise: 0,
        shipping_type: "zero",
        shipping_flat_paise: 5_000,
        shipping_slabs: [],
        tax_mode: "inclusive",
        tax_rate_bps: 500,
        currency: "INR",
        updated_at: "2026-10-01T00:00:00Z",
      },
    });

    await expect(getCommerceRules()).resolves.toMatchObject({
      minOrderPaise: 100,
      shippingType: "zero",
    });
  });

  it("reads as INR whatever the row holds, so a stale value cannot reach the bank", async () => {
    rulesDb({ data: { shipping_type: "zero", currency: "USD", updated_at: "2026-10-01T00:00:00Z" } });

    await expect(getCommerceRules()).resolves.toMatchObject({ currency: "INR" });
  });

  it("uses the defaults when the row is missing", async () => {
    rulesDb({ data: null });
    await expect(getCommerceRules()).resolves.toEqual(DEFAULT_COMMERCE_RULES);
  });

  it("throws on a failed read rather than pass the defaults off as live", async () => {
    rulesDb({ error: { message: "connection reset" } });
    await expect(getCommerceRules()).rejects.toThrow("connection reset");
  });
});

describe("isServiceable", () => {
  beforeEach(() => {
    h.db = null;
  });

  it("is true for every pincode while no area is live", async () => {
    areasDb({ count: 0 });
    await expect(isServiceable("110001")).resolves.toBe(true);
  });

  it("does not refuse a blank pincode while no area is live", async () => {
    areasDb({ count: 0 });
    await expect(isServiceable("")).resolves.toBe(true);
  });

  it("is true for a pincode on the live list", async () => {
    const { ops } = areasDb({ count: 3 }, { count: 1 });

    await expect(isServiceable(" 500081 ")).resolves.toBe(true);

    expect(filterOn(ops[1], "pincode")?.value).toBe("500081");
    expect(filterOn(ops[1], "active")?.value).toBe(true);
  });

  it("is false for a pincode off the live list", async () => {
    areasDb({ count: 3 }, { count: 0 });
    await expect(isServiceable("110001")).resolves.toBe(false);
  });

  it("refuses a blank pincode once a list exists", async () => {
    areasDb({ count: 3 });
    await expect(isServiceable("")).resolves.toBe(false);
  });

  it("throws rather than answer when the count fails", async () => {
    areasDb({ error: { message: "connection reset" } });
    await expect(isServiceable("500081")).rejects.toThrow("connection reset");
  });

  it("throws rather than answer when the match fails", async () => {
    areasDb({ count: 3 }, { error: { message: "connection reset" } });
    await expect(isServiceable("500081")).rejects.toThrow("connection reset");
  });
});
