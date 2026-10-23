import { describe, expect, it } from "vitest";
import type { ProductCard, ProductVariantOption } from "@/types/nutrigreenz";
import { productDescription, productGroupJsonLd, productTitle, searchName, sizeRange, variantsBySize } from "@/lib/product-seo";
import { CATEGORY_GUIDES, productAnswer } from "@/lib/category-guides";

function variant(label: string, value: number, unit: string, price: number, extra: Partial<ProductVariantOption> = {}): ProductVariantOption {
  return { id: `${label}-${extra.pack ?? "glass"}`, sku: `SKU-${label}`, label, pack: "glass", sizeValue: value, sizeUnit: unit, price, inStock: true, imageUrl: null, ...extra };
}

function product(slug: string, title: string, variants: ProductVariantOption[]): ProductCard {
  return { id: slug, slug, title, image: "/images/x.webp", rating: 0, reviewCount: 0, price: 1, variants, tags: [] };
}

const groundnut = product("groundnut-cold-pressed-oil", "Groundnut Cold-Pressed Oil", [
  variant("15L", 15, "L", 15),
  variant("1L", 1, "L", 1),
  variant("5L", 5, "L", 5, { pack: "tin", price: 4 }),
  variant("5L", 5, "L", 5),
  variant("3L", 3, "L", 3),
  variant("10L", 10, "L", 10),
]);

const acacia = product("kashmiri-acacia-honey", "Kashmiri Acacia Honey", [variant("500g", 500, "g", 2), variant("350g", 350, "g", 1)]);

describe("searchName", () => {
  it("puts the process first for oils, the way people search", () => {
    expect(searchName("Groundnut Cold-Pressed Oil")).toBe("Cold-Pressed Groundnut Oil");
    expect(searchName("Sesame Cold Pressed Oil")).toBe("Cold-Pressed Sesame Oil");
  });
  it("leaves other names alone", () => {
    expect(searchName("A2 Gir Cow Ghee")).toBe("A2 Gir Cow Ghee");
  });
});

describe("sizes", () => {
  it("keeps one variant per size, smallest first, preferring the cheaper pack", () => {
    const sizes = variantsBySize(groundnut);
    expect(sizes.map((v) => v.label)).toEqual(["1L", "3L", "5L", "10L", "15L"]);
    expect(sizes.find((v) => v.label === "5L")?.pack).toBe("tin");
  });
  it("sorts across units", () => {
    const p = product("x", "X", [variant("1L", 1, "L", 1), variant("500ml", 500, "ml", 1)]);
    expect(variantsBySize(p).map((v) => v.label)).toEqual(["500ml", "1L"]);
  });
  it("describes a range naturally", () => {
    expect(sizeRange([])).toBe("");
    expect(sizeRange(["500g"])).toBe("500g");
    expect(sizeRange(["350g", "500g"])).toBe("350g & 500g");
    expect(sizeRange(["1L", "3L", "15L"])).toBe("1L to 15L");
  });
});

describe("productTitle", () => {
  it("names the product, its sizes and the brand within 60 characters", () => {
    expect(productTitle(groundnut)).toBe("Cold-Pressed Groundnut Oil, 1L to 15L | Nutri Greenz");
    expect(productTitle(acacia)).toBe("Kashmiri Acacia Honey, 350g & 500g | Nutri Greenz");
  });
  it("drops the sizes rather than run long", () => {
    const long = product("x", "Extraordinarily Long Wild Himalayan Forest Honey", [variant("350g", 350, "g", 1), variant("1kg", 1, "kg", 2)]);
    expect(productTitle(long)).toBe("Extraordinarily Long Wild Himalayan Forest Honey | Nutri Greenz");
  });
});

describe("productDescription", () => {
  it("stays within the snippet width", () => {
    for (const [p, cat] of [[groundnut, "oils"], [acacia, "honey"]] as const) {
      const d = productDescription(p, cat, "over ₹999");
      expect(d.length).toBeLessThanOrEqual(155);
      expect(d.startsWith(`Buy ${searchName(p.title)} online in Hyderabad.`)).toBe(true);
    }
  });
  it("includes the delivery rule when it fits", () => {
    expect(productDescription(acacia, "honey", "over ₹999")).toContain("Free delivery over ₹999.");
  });
});

describe("productGroupJsonLd", () => {
  it("emits one Product per size with the operator SKU", () => {
    const ld = productGroupJsonLd({ product: groundnut, description: "d", categoryTitle: "Cold-Pressed Oils", image: "/images/x.webp" });
    expect(ld["@type"]).toBe("ProductGroup");
    const group = ld as { productGroupID: string; hasVariant: object[]; image: string[] };
    expect(group.productGroupID).toBe("groundnut-cold-pressed-oil");
    expect(group.hasVariant).toHaveLength(5);
    expect(group.hasVariant[0]).toMatchObject({ sku: "SKU-1L", size: "1L", offers: { price: 1, priceCurrency: "INR" } });
    expect(group.image[0]).toBe("https://nutrigreenz.farm/images/x.webp");
  });
  it("falls back to a single Product when there are no variants", () => {
    const ld = productGroupJsonLd({ product: product("p", "Pure Ghee", []), description: "d", categoryTitle: "Ghee", image: "/i.webp" });
    expect(ld["@type"]).toBe("Product");
  });
});

describe("guides", () => {
  it("keeps every answer quotable: 35 to 80 words", () => {
    for (const guide of Object.values(CATEGORY_GUIDES)) {
      for (const a of guide.answers) {
        const words = a.answer.split(/\s+/).length;
        expect(words, a.question).toBeGreaterThanOrEqual(35);
        expect(words, a.question).toBeLessThanOrEqual(80);
      }
      expect(guide.metaTitle.length).toBeLessThanOrEqual(60);
      expect(guide.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });
  it("answers what a product is, with our sizes", () => {
    const a = productAnswer(groundnut, "oils");
    expect(a?.question).toBe("What is Cold-Pressed Groundnut Oil?");
    expect(a?.answer).toContain("groundnuts (peanuts)");
    expect(a?.answer).toContain("in 1L to 15L packs");
  });
});
