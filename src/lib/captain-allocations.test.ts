import { describe, expect, it, vi } from "vitest";
import { fakeDb, type Resolver } from "@/lib/__tests__/captain-fake-db";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: () => h.db }));

import { allocationsForCaptain, setAllocations } from "@/lib/captain-allocations";

const withDb = (resolve: Resolver) => {
  const fake = fakeDb(resolve);
  h.db = fake.db;
  return fake;
};
const variant = (over: Record<string, unknown> = {}) => ({
  id: "v1", product_id: "p1", sku: "HNY-500", label: "500g", pack: null, price_paise: 34_950,
  stock: 10, reserved: 2, is_active: true, products: { name: "Honey" }, ...over,
});

describe("allocationsForCaptain", () => {
  it("keeps the exact stall price (₹349.50 was rounded to ₹350)", async () => {
    withDb(() => ({ data: [{ variant_id: "v1", price_paise: null, product_variants: variant() }] }));
    const [item] = await allocationsForCaptain("cap-1");
    expect(item).toMatchObject({ price: 349.5, pricePaise: 34_950, overridden: false, available: 8 });
  });

  it("uses the override when set", async () => {
    withDb(() => ({ data: [{ variant_id: "v1", price_paise: 30_000, product_variants: variant() }] }));
    expect((await allocationsForCaptain("cap-1"))[0]).toMatchObject({ pricePaise: 30_000, overridden: true });
  });

  it("fails closed: inactive variants and ₹0 prices are not offered", async () => {
    withDb(() => ({
      data: [
        { variant_id: "v1", price_paise: null, product_variants: variant({ is_active: false }) },
        { variant_id: "v2", price_paise: null, product_variants: variant({ id: "v2", price_paise: 0 }) },
        { variant_id: "v3", price_paise: null, product_variants: null },
      ],
    }));
    expect(await allocationsForCaptain("cap-1")).toEqual([]);
  });

  it("only reads active allocation rows for this captain, and returns [] on error", async () => {
    const fake = withDb(() => ({ error: { message: "down" } }));
    expect(await allocationsForCaptain("cap-1")).toEqual([]);
    expect(fake.ops[0].filters).toEqual(expect.arrayContaining([["eq", "captain_id", "cap-1"], ["eq", "active", true]]));
  });
});

describe("setAllocations", () => {
  it("leaves existing overrides alone when the picker sends no price", async () => {
    const fake = withDb(() => ({}));
    await setAllocations("cap-1", [{ variantId: "v1" }, { variantId: "v2", pricePaise: 12_345 }, { variantId: "v3", pricePaise: null }]);
    const upserts = fake.ops.filter((o) => o.action === "upsert");
    expect(upserts).toHaveLength(2);
    const priced = upserts[0].payload as Array<Record<string, unknown>>;
    const unpriced = upserts[1].payload as Array<Record<string, unknown>>;
    expect(priced.map((r) => [r.variant_id, r.price_paise])).toEqual([["v2", 12_345], ["v3", null]]);
    expect(unpriced).toEqual([expect.not.objectContaining({ price_paise: expect.anything() })]);
    expect(unpriced[0]).not.toHaveProperty("price_paise");
  });

  it("throws when removing de-selected rows fails, instead of carrying on", async () => {
    withDb((op) => (op.action === "delete" ? { error: { message: "denied" } } : {}));
    await expect(setAllocations("cap-1", [{ variantId: "v1" }])).rejects.toThrow("denied");
  });
});
