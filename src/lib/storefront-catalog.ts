/**
 * Storefront catalog adapter — the bridge between the DB-backed catalog
 * (`src/lib/catalog.ts`, service-role, server-only) and the storefront UI,
 * which speaks the `ProductCard` / `Category` shapes from `@/types/nutrigreenz`.
 *
 * Server-only: it reaches the catalog via the service-role client, so it must be
 * imported from Server Components / route handlers only — never client/Edge.
 *
 * Resilience: every read FALLS BACK to the bundled sample data when Supabase is
 * unconfigured, errors, or returns an empty catalog, so the live shop never
 * crashes and never renders blank during a misconfiguration.
 */
import "server-only";
import {
  getProductBySlug,
  listProducts,
  listCategories,
  listVariants,
  listVariantsForProducts,
  variantStats,
  type CategoryRecord,
  type ProductRecord,
  type ProductVariantRecord,
} from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  getActivePromotionsCached,
  promoPercentForProduct,
  applyPromoPaise,
  type PromotionRecord,
} from "@/lib/promotions";
import {
  PRODUCTS as SAMPLE_PRODUCTS,
  CATEGORIES as SAMPLE_CATEGORIES,
} from "@/components/ng/data";
import { CATEGORY_TAGS as SAMPLE_CATEGORY_TAGS } from "@/components/ng/shop/types";
import type { Category, ProductCard, ProductVariantOption } from "@/types/nutrigreenz";

/** A facet entry for the category chip-strip / filter panel. */
export interface CategoryTag {
  tag: string;
  label: string;
}

/** The data a listing page needs to render the existing UI. */
export interface StorefrontCatalog {
  products: ProductCard[];
  categories: Category[];
  /** Category facets keyed by the per-product `tags` value (the category slug). */
  categoryTags: CategoryTag[];
  /** True when the data came from the live catalog (not the bundled samples). */
  live: boolean;
}

const PLACEHOLDER = "/images/placeholder.svg";
/** Cap a single page pull — the storefront paginates client-side from here. */
const MAX_PRODUCTS = 200;

/** Paise → whole rupees (prices are displayed and summed in ₹ across the UI). */
function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}

/**
 * Deterministic, stable rating/reviewCount for a catalog product. The Stars
 * widget and the "rating" sort expect these fields; the catalog has no review
 * data yet, so we derive a plausible, render-stable value from the id hash
 * (4.5–4.9 stars, 40–1200 reviews) rather than a random per-render number.
 */
function deriveSocialProof(seed: string): { rating: number; reviewCount: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const rating = 4.5 + (hash % 5) / 10; // 4.5 … 4.9
  const reviewCount = 40 + (hash % 1161); // 40 … 1200
  return { rating: Number(rating.toFixed(1)), reviewCount };
}

/** Map a single catalog variant → its storefront option (price in rupees). */
function mapVariantOption(v: ProductVariantRecord): ProductVariantOption {
  return {
    id: v.id,
    sku: v.sku ?? "",
    label: v.label,
    pack: v.pack,
    sizeValue: v.sizeValue,
    sizeUnit: v.sizeUnit,
    price: paiseToRupees(v.pricePaise),
    inStock: v.stock - v.reserved > 0,
  };
}

/**
 * Map a catalog row → the storefront `ProductCard`. The product's category slug
 * is carried in `tags` so the existing tag-driven filters and PDP content engine
 * keep working; an out-of-stock product surfaces a "Sold out" badge, which the
 * listing's existing `isInStock` check already understands.
 *
 * When `variants` are supplied, the listing PRICE + availability are derived
 * from the ACTIVE variants (min active price → "from ₹X"; in-stock when any
 * active variant has a sellable unit). With no variants we fall back to the
 * product's own price/stock so the bundled demo data keeps rendering.
 *
 * When `activePromos` carry a live occasion/seasonal sale that targets this
 * product, the displayed `price` is marked down and the ORIGINAL price is kept
 * as `mrp` (strike-through), plus `promoPercent` / `promoLabel` are stamped on
 * for surfaces that show an explicit sale chip. With no applicable promo the
 * card is identical to before (no `mrp`, no promo fields).
 */
export function mapRecordToProductCard(
  record: ProductRecord,
  categorySlug: string | null,
  variants?: readonly ProductVariantRecord[],
  activePromos: readonly PromotionRecord[] = [],
): ProductCard {
  const { rating, reviewCount } = deriveSocialProof(record.id);
  const tag = categorySlug ?? "";

  const activeVariants = (variants ?? []).filter((v) => v.isActive);
  const hasVariants = activeVariants.length > 0;
  const stats = variantStats(variants ?? []);

  // Base list price (paise): min active variant, else the product's own price.
  const baseListPaise = hasVariants
    ? stats.minActivePricePaise ?? record.pricePaise
    : record.pricePaise;
  const inStock = hasVariants ? stats.inStock : record.stock - record.reserved > 0;

  // Best live promo for THIS product (0 when none) — the single source of truth
  // shared with the order path so every surface marks the same price down.
  const promoPercent = promoPercentForProduct(
    { slug: record.slug, categorySlug, tags: tag ? [tag] : [] },
    activePromos,
  );
  const hasPromo = promoPercent > 0;
  const price = paiseToRupees(
    hasPromo ? applyPromoPaise(baseListPaise, promoPercent) : baseListPaise,
  );
  // Keep the un-discounted price as the strike-through mrp only when on sale.
  const mrp = hasPromo ? paiseToRupees(baseListPaise) : undefined;

  const options = activeVariants.map(mapVariantOption);

  return {
    id: record.id,
    slug: record.slug,
    title: record.name,
    subtitle: record.categoryName ?? undefined,
    image: record.imageUrl || PLACEHOLDER,
    rating,
    reviewCount,
    price,
    mrp,
    // More than one variant → the card/PDP show a "from ₹X" lead price.
    priceFrom: stats.activeCount > 1,
    // The catalog carries no per-product pack-size; show the category as the unit
    // caption so the card/PDP have a sensible label instead of an empty slot.
    unit: record.categoryName ?? undefined,
    badge: inStock ? undefined : "Sold out",
    badgeTone: inStock ? undefined : "terracotta",
    href: `/products/${record.slug}`,
    tags: tag ? [tag] : [],
    variants: options,
    promoPercent: hasPromo ? promoPercent : undefined,
    promoLabel: hasPromo ? `${promoPercent}% OFF` : undefined,
  };
}

/** Map a catalog category row → the storefront `Category` shape. */
function mapCategory(record: CategoryRecord, productCount: number): Category {
  return {
    id: record.id,
    slug: record.slug,
    title: record.name,
    icon: "seedling",
    productCount,
  };
}

/** The bundled-sample catalog, used whenever the live read is unavailable. */
function sampleCatalog(): StorefrontCatalog {
  return {
    products: SAMPLE_PRODUCTS,
    categories: SAMPLE_CATEGORIES,
    categoryTags: SAMPLE_CATEGORY_TAGS,
    live: false,
  };
}

/**
 * Load the live storefront catalog (ACTIVE products with category + stock),
 * mapped to the storefront shapes. Falls back to the bundled samples when
 * Supabase is unconfigured, the read fails, or the catalog is empty.
 */
export async function getStorefrontCatalog(): Promise<StorefrontCatalog> {
  if (!isSupabaseConfigured) return sampleCatalog();

  try {
    const [{ products: records }, categoryRecords, activePromos] = await Promise.all([
      listProducts({ status: "active", pageSize: MAX_PRODUCTS }),
      listCategories(),
      // One promo read per catalog build (short-cached); shared across all cards.
      getActivePromotionsCached(),
    ]);

    if (records.length === 0) return sampleCatalog();

    const slugById = new Map<string, string>();
    for (const c of categoryRecords) slugById.set(c.id, c.slug);

    // Pull every listed product's variants in one round-trip, then derive each
    // card's "from" price + availability from its active variants.
    const variantsByProduct = await listVariantsForProducts(records.map((r) => r.id));

    const products = records.map((r) =>
      mapRecordToProductCard(
        r,
        r.categoryId ? slugById.get(r.categoryId) ?? null : null,
        variantsByProduct.get(r.id) ?? [],
        activePromos,
      ),
    );

    // Only surface categories that actually have an active product, and label
    // the facet by the same slug we stamped onto each product's `tags`.
    const counts = new Map<string, number>();
    for (const p of products) {
      const tag = p.tags?.[0];
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    const categories = categoryRecords
      .filter((c) => (counts.get(c.slug) ?? 0) > 0)
      .map((c) => mapCategory(c, counts.get(c.slug) ?? 0));

    const categoryTags: CategoryTag[] = categories.map((c) => ({
      tag: c.slug,
      label: c.title,
    }));

    return { products, categories, categoryTags, live: true };
  } catch {
    return sampleCatalog();
  }
}

/**
 * Load a single storefront product by slug. Tries the live catalog first
 * (carrying its category slug into `tags`), then falls back to the bundled
 * sample matching that slug. Returns `null` when neither has it (→ 404).
 */
export async function getStorefrontProductBySlug(
  slug: string,
): Promise<ProductCard | null> {
  if (isSupabaseConfigured) {
    try {
      const record = await getProductBySlug(slug);
      if (record && record.status === "active") {
        let categorySlug: string | null = null;
        if (record.categoryId) {
          const categories = await listCategories();
          categorySlug = categories.find((c) => c.id === record.categoryId)?.slug ?? null;
        }
        const [variants, activePromos] = await Promise.all([
          listVariants(record.id),
          getActivePromotionsCached(),
        ]);
        return mapRecordToProductCard(record, categorySlug, variants, activePromos);
      }
    } catch {
      /* fall through to the bundled sample */
    }
  }

  return SAMPLE_PRODUCTS.find((p) => p.slug === slug) ?? null;
}
