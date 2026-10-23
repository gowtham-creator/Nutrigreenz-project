import type { ProductCard, ProductVariantOption } from "@/types/nutrigreenz";
import { ORG_ID, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * Search titles, descriptions and structured data for product pages.
 *
 * Built from the product's real variants, so a title promises the sizes a
 * shopper can actually add to the cart, and changes when the catalogue does.
 */

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/**
 * "Groundnut Cold-Pressed Oil" → "Cold-Pressed Groundnut Oil".
 *
 * The catalogue names oils seed-first, but people search "cold pressed
 * groundnut oil". Only the search title and structured data use this order;
 * the page heading keeps the catalogue name.
 */
export function searchName(title: string): string {
  const m = title.trim().match(/^(.+?)\s+cold[- ]pressed\s+oil$/i);
  return m ? `Cold-Pressed ${m[1]} Oil` : title.trim();
}

/** Size in millilitres or grams, so "500ml" sorts before "1L". */
function baseQuantity(v: ProductVariantOption): number {
  const value = v.sizeValue ?? parseFloat(v.label);
  if (!Number.isFinite(value)) return Number.MAX_SAFE_INTEGER;
  const unit = (v.sizeUnit ?? v.label.replace(/[\d.\s]/g, "")).toLowerCase();
  return unit === "l" || unit === "kg" ? value * 1000 : value;
}

/**
 * One variant per pack size, smallest first.
 *
 * A size can come in several packs (glass, tin). Search results describe the
 * size, so each size keeps its cheapest in-stock variant.
 */
export function variantsBySize(p: ProductCard): ProductVariantOption[] {
  const bySize = new Map<string, ProductVariantOption>();
  for (const v of p.variants ?? []) {
    const key = v.label.trim().toLowerCase();
    const held = bySize.get(key);
    const better =
      !held ||
      (v.inStock && !held.inStock) ||
      (v.inStock === held.inStock && v.price < held.price);
    if (better) bySize.set(key, v);
  }
  return [...bySize.values()].sort((a, b) => baseQuantity(a) - baseQuantity(b));
}

/** "1L to 15L", "250ml & 500ml", "500g", or "" when there are no sizes. */
export function sizeRange(labels: readonly string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]} to ${labels[labels.length - 1]}`;
}

export function productTitle(p: ProductCard): string {
  const name = searchName(p.title);
  const range = sizeRange(variantsBySize(p).map((v) => v.label));
  const full = range ? `${name}, ${range} | ${SITE_NAME}` : `${name} | ${SITE_NAME}`;
  return full.length <= TITLE_MAX ? full : `${name} | ${SITE_NAME}`;
}

/** What makes each category worth buying, in under ten words. */
const CATEGORY_LINE: Record<string, string> = {
  oils: "Wood-pressed (ganuga), single-origin and lab-tested",
  ghee: "Single-origin, lab-tested and traceable to the dairy",
  honey: "Raw, unheated and lab-tested, with no added sugar",
};

/**
 * `Buy {name} online in Hyderabad. {category line}. {sizes}. Free delivery {rule}.`
 *
 * Sentences drop from the end of the priority list until the whole fits the
 * snippet width, so a long product name loses the size sentence before it
 * loses what the product is.
 */
export function productDescription(p: ProductCard, categorySlug: string, freeDelivery: string): string {
  const name = searchName(p.title);
  const sizes = variantsBySize(p).map((v) => v.label);
  const sizeSentence =
    sizes.length > 2 ? `Packs from ${sizes[0]} to ${sizes[sizes.length - 1]}.` : sizes.length > 0 ? `Available in ${sizes.join(" and ")}.` : "";

  const required = [`Buy ${name} online in Hyderabad.`];
  const line = CATEGORY_LINE[categorySlug];
  if (line) required.push(`${line}.`);
  // Lowest priority last: these are the first to go when space runs out.
  const optional = [`Free delivery ${freeDelivery}.`, sizeSentence].filter(Boolean);

  const parts = [...required, ...optional];
  while (parts.length > required.length && parts.join(" ").length > DESCRIPTION_MAX) parts.pop();
  return parts.join(" ");
}

/**
 * ProductGroup with one Product per size.
 *
 * Replaces a single Offer keyed by the product's database UUID. Each size is
 * now its own offer with the operator's SKU (e.g. OIL-GNO-1L-GLASS) and its own
 * price and stock, which is what Google's merchant listings read.
 */
export function productGroupJsonLd({
  product: p,
  description,
  categoryTitle,
  image,
}: {
  product: ProductCard;
  description: string;
  categoryTitle: string;
  image: string;
}) {
  const url = `${SITE_URL}/products/${p.slug}`;
  const name = searchName(p.title);
  const brand = { "@type": "Brand", name: SITE_NAME };
  const absolute = (src: string) => (src.startsWith("http") ? src : `${SITE_URL}${src}`);
  const offer = (price: number, inStock: boolean) => ({
    "@type": "Offer",
    url,
    priceCurrency: "INR",
    price,
    availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@id": ORG_ID },
  });

  const sizes = variantsBySize(p);
  if (sizes.length === 0) {
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": `${url}#product`,
      name,
      description,
      url,
      image: [absolute(image)],
      sku: p.slug,
      brand,
      category: categoryTitle,
      offers: offer(p.price, (p.badge ?? "").toLowerCase() !== "sold out"),
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${url}#product`,
    name,
    description,
    url,
    image: [absolute(image)],
    brand,
    category: categoryTitle,
    productGroupID: p.slug,
    variesBy: ["https://schema.org/size"],
    hasVariant: sizes.map((v) => ({
      "@type": "Product",
      name: `${name}, ${v.label}`,
      sku: v.sku || `${p.slug}-${v.label}`.toUpperCase(),
      size: v.label,
      image: [absolute(v.imageUrl || image)],
      offers: offer(v.price, v.inStock),
    })),
  };
}
