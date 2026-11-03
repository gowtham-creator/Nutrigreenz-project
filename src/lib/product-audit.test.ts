/** The product audit log records exactly what changed, and files it correctly. */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: vi.fn() }));

import { diffFields, matchesKind, productChange, snapshotChanges, variantChange } from "./product-audit";
import type { ProductRecord, ProductVariantRecord } from "./catalog";

const actor = { email: "owner@nutrigreenz.farm", role: "superadmin" };

const product = (over: Partial<ProductRecord> = {}): ProductRecord => ({
  id: "p1",
  categoryId: "c1",
  categoryName: "Oils",
  name: "Groundnut Oil",
  slug: "groundnut-oil",
  description: "Cold pressed",
  pricePaise: 25000,
  imageUrl: null,
  gallery: [],
  sku: "GO-1L",
  status: "active",
  stock: 40,
  reserved: 2,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ...over,
});

const variant = (over: Partial<ProductVariantRecord> = {}): ProductVariantRecord => ({
  id: "v1",
  productId: "p1",
  label: "1 L",
  pack: null,
  sizeValue: 1,
  sizeUnit: "L",
  pricePaise: 25000,
  sku: null,
  stock: 10,
  reserved: 0,
  isActive: true,
  sort: 0,
  imageUrl: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ...over,
});

describe("diffFields", () => {
  it("lists only the fields that changed, with old and new values", () => {
    const changes = diffFields({ a: 1, b: "x", c: [1] }, { a: 2, b: "x", c: [1, 2] }, ["a", "b", "c"]);
    expect(changes).toEqual([
      { field: "a", from: 1, to: 2 },
      { field: "c", from: [1], to: [1, 2] },
    ]);
  });

  it("treats empty text and nothing as the same", () => {
    expect(diffFields({ sku: "" }, { sku: null }, ["sku"])).toEqual([]);
  });

  it("clips long text so the log stays small", () => {
    const [c] = diffFields({ d: "a" }, { d: "x".repeat(1000) }, ["d"]);
    expect(String(c.to).length).toBeLessThan(410);
  });
});

describe("productChange", () => {
  it("records a price change as an edit", () => {
    const c = productChange(product(), product({ pricePaise: 27000 }), actor);
    expect(c?.action).toBe("updated");
    expect(c?.changes).toEqual([{ field: "pricePaise", from: 25000, to: 27000 }]);
  });

  it("files a stock-only change under stock", () => {
    expect(productChange(product(), product({ stock: 35 }), actor)?.action).toBe("stock");
  });

  it("records what a new product started with, and a deletion", () => {
    const created = productChange(null, product(), actor);
    expect(created?.action).toBe("created");
    expect(created?.changes.map((c) => c.field)).toContain("pricePaise");
    expect(created?.changes.map((c) => c.field)).not.toContain("imageUrl");
    expect(productChange(product(), null, actor)?.action).toBe("deleted");
  });

  it("records nothing for a save that changed nothing", () => {
    expect(productChange(product(), product({ updatedAt: "2026-11-02T00:00:00Z" }), actor)?.changes).toEqual([]);
  });
});

describe("variantChange", () => {
  it("names the variant and files its stock separately", () => {
    const c = variantChange(product(), variant(), variant({ stock: 4 }), actor);
    expect(c?.action).toBe("variant_stock");
    expect(c?.variant?.label).toBe("1 L");
    expect(variantChange(product(), variant(), variant({ isActive: false }), actor)?.action).toBe("variant_updated");
  });
});

describe("snapshotChanges (CSV imports)", () => {
  it("logs each product an import added or changed, and skips the rest", () => {
    const before = [product(), product({ id: "p2", name: "Honey" })];
    const after = [product({ pricePaise: 26000 }), product({ id: "p2", name: "Honey" }), product({ id: "p3", name: "Ghee" })];
    const out = snapshotChanges(before, after, (b, a) => productChange(b, a, actor, "import"));
    expect(out.map((c) => [c.product.id, c.action, c.source])).toEqual([
      ["p1", "updated", "import"],
      ["p3", "created", "import"],
    ]);
  });
});

describe("matchesKind", () => {
  const entry = (action: string, fields: string[]) => ({
    action: action as never,
    changes: fields.map((field) => ({ field, from: 1, to: 2 })),
  });

  it("puts each change under the right filter", () => {
    expect(matchesKind(entry("updated", ["pricePaise"]), "price")).toBe(true);
    expect(matchesKind(entry("updated", ["pricePaise"]), "details")).toBe(false);
    expect(matchesKind(entry("stock", ["stock"]), "stock")).toBe(true);
    expect(matchesKind(entry("variant_stock", ["stock"]), "variants")).toBe(true);
    expect(matchesKind(entry("updated", ["name", "pricePaise"]), "details")).toBe(true);
    expect(matchesKind(entry("deleted", []), "added-removed")).toBe(true);
  });
});
