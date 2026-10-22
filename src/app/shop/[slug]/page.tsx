import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Chip } from "@/components/ng/chip";
import { Icon } from "@/components/ui/icon";
import { ProductListing } from "@/components/ng/shop/product-listing";
import { ShopTrustStrip } from "@/components/ng/shop/trust-strip";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";
import { getCategoryTheme } from "@/lib/category-theme";
import { pageMeta, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/ng/json-ld";
import { ProductGridFallback } from "@/components/ng/shop/product-grid-fallback";

// Re-fetch the catalog at most once a minute so Inventory-Portal edits surface
// on category pages without a redeploy.
export const revalidate = 60;

/**
 * Enumerate the live category slugs at build time.
 *
 * Same fix, and the same reason, as the PDP: `revalidate` on a dynamic segment
 * with no `generateStaticParams` builds no ISR entry at all, so the route
 * compiled as `ƒ (Dynamic)` and every visit re-rendered the whole catalogue.
 * Measured on production before this change: 1215–2664ms per category, every
 * request `MISS`, answering `private, no-cache, no-store`.
 *
 * These sit between the shop index and the product page, so a customer walking
 * /shop → /shop/oils → /products/… was paying that twice on the way to buying.
 *
 * `dynamicParams` stays at its default, so a category added later still
 * resolves — rendered once, then cached.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const { categories } = await getStorefrontCatalog();
    return categories.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

const CATEGORY_BLURBS: Record<string, string> = {
  oils: "Single-press, never refined. Each bottle traceable to the village ghani and the harvest lot it came from.",
  ghee: "Bilona-churned from A2 milk on the day it's collected, from named cows and dairies.",
  honey: "Raw, unheated, lab-tested for purity. Harvested without smoke or queen-killing.",
  millets: "Climate-smart grains from dryland farms we helped transition away from monoculture.",
  spices: "Whole, sun-dried, stone-milled in small batches so the oils stay alive.",
  superfoods: "Nutrient-dense staples: sun-dried, cold-milled, nothing added.",
  pulses: "Unpolished dals and pulses, sorted by hand, free of artificial colour.",
  flours: "Stone-ground in slow chakkis so the bran and germ stay in the bag.",
  fruits: "Seasonal produce picked ripe and shipped within the harvest window.",
  gifting: "Hampers of our best-loved jars, ready to give and fully traceable.",
};

// Category heroes use real origin/craft photography — NOT the product banners —
// so a category page evokes the whole category (its source + how it's made)
// rather than advertising one SKU. The subject sits behind the left→right cream
// scrim; categories without a photo fall back to the tinted wash.
const CATEGORY_HERO: Record<string, string> = {
  oils: "/images/categories/oils-hero.webp", // hands pressing groundnuts on a wooden ghani, oil pouring
  ghee: "/images/farm/gir-farm.webp", // Gir cows at golden hour — the source of A2 ghee
  honey: "/images/farm/bee-coop.webp", // beekeeper lifting a honeycomb frame
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { categories } = await getStorefrontCatalog();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found · Nutri Greenz" };
  return pageMeta({
    title: `${cat.title} · Nutri Greenz`,
    description: CATEGORY_BLURBS[slug] ?? `Shop ${cat.title} from named partner farms. Single-origin, lab-tested.`,
    path: `/shop/${slug}`,
  });
}

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { products, categories, categoryTags } = await getStorefrontCatalog();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();

  const count = products.filter((p) => p.tags?.includes(slug)).length;
  const words = cat.title.split(" ");
  // Per-category look — an Oils page shouldn't read like Honey or Spices.
  const theme = getCategoryTheme(slug);
  // Categories with a real origin/craft photo show it behind the light cream
  // scrim with the soft-serif title; others keep the plain tinted wash.
  const heroImage = CATEGORY_HERO[slug];

  return (
    <PageShell>
      <div style={{ background: theme.bg }}>
      <PageHero
        eyebrow={`Category · ${count} ${count === 1 ? "product" : "products"}`}
        wash={theme.heroWash}
        image={heroImage}
        serifTitle={Boolean(heroImage)}
        title={
          <>
            {words.map((w, i) =>
              i === words.length - 1 ? (
                <em key={i} className="italic text-ng-leaf">
                  {w}
                </em>
              ) : (
                <span key={i}>{w} </span>
              ),
            )}
          </>
        }
        description={CATEGORY_BLURBS[slug] ?? "Direct from named partner farms. Every lot lab-tested before it ships."}
      >
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-1.5 text-[13px] text-ng-ink-muted">
          <Link href="/" className="transition-colors hover:text-ng-forest">
            Home
          </Link>
          <Icon name="alt-arrow-right-linear" size={14} />
          <Link href="/shop" className="transition-colors hover:text-ng-forest">
            Shop
          </Link>
          <Icon name="alt-arrow-right-linear" size={14} />
          <span className="font-medium text-ng-forest">{cat.title}</span>
        </nav>

        {/* Category switcher */}
        <div className="mt-7 flex flex-wrap gap-2">
          <Link href="/shop">
            <Chip>All</Chip>
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/shop/${c.slug}`}>
              <Chip active={c.slug === slug}>{c.title}</Chip>
            </Link>
          ))}
        </div>
      </PageHero>

      <ShopTrustStrip />
      {/* Suspense because ProductListing reads ?q= via useSearchParams, which
          opts a client component out of prerendering unless a boundary exists.
          Without it the whole page falls back to client-side rendering and the
          catalogue stops being static. */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: cat.title, path: `/shop/${slug}` },
        ])}
      />
      <Suspense fallback={<ProductGridFallback products={products.filter((p) => p.tags?.includes(slug))} />}>
        <ProductListing products={products} categoryTags={categoryTags} categorySlug={slug} />
      </Suspense>
      </div>
    </PageShell>
  );
}
