import { PromoBar } from "@/components/ng/promo-bar";
import { Header } from "@/components/ng/header";
import { Footer } from "@/components/ng/footer";
import { Hero } from "@/components/ng/sections/hero";
import { AssuranceStrip } from "@/components/ng/sections/assurance-strip";
import { ShopByCategory } from "@/components/ng/sections/shop-by-category";
import { Why } from "@/components/ng/sections/why";
import { NativeIngredients } from "@/components/ng/sections/native-ingredients";
import { OnlyPerfect } from "@/components/ng/sections/only-perfect";
import { ProductInFocus, type FocusSubTab } from "@/components/ng/sections/product-in-focus";
import { Farms } from "@/components/ng/sections/farms";
import { Testimonials } from "@/components/ng/sections/testimonials";
import { Journal } from "@/components/ng/sections/journal";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";
import { getHeroPromotion } from "@/lib/promotions";
import type { ProductCard } from "@/types/nutrigreenz";

// Re-fetch the catalog at most once a minute so Inventory-Portal edits (price,
// stock, new SKUs, status) appear on the home page without a redeploy — the same
// ISR window the shop + product pages use, so home → shop → PDP stay consistent.
export const revalidate = 60;

/**
 * Tag helper for building each section's product pool. The live catalog stamps a
 * product's category SLUG into `tags` (e.g. `oils`), while the bundled offline
 * sample uses the singular demo tag (`oil`); pass both so each rail is populated
 * against the real catalog AND the resilience fallback.
 */
const hasTag =
  (...tags: string[]) =>
  (p: ProductCard) =>
    p.tags?.some((t) => tags.includes(t)) ?? false;

export default async function Home() {
  // Single source of truth for every catalog-backed home section. Falls back to
  // the bundled sample when Supabase is unconfigured/empty, so it's never blank.
  const { products, categories } = await getStorefrontCatalog();

  // Active hero promotion — prepended as the first hero banner when a sale is
  // live. getHeroPromotion() already swallows backend errors (returns null); the
  // extra .catch keeps the home page rendering even if the module itself throws.
  const heroPromo = await getHeroPromotion().catch(() => null);

  // ── OILS (Cold-Pressed Oils) ──────────────────────────────────────────
  // Sub-tab `filter`s are serializable descriptors (no functions) so they can
  // cross the Server → Client boundary into <ProductInFocus>.
  const oils = products.filter(hasTag("oils", "oil"));
  const oilTabs: FocusSubTab[] = [
    { label: "All oils", icon: "brandMark", filter: { type: "all" } },
    { label: "Groundnut", icon: "groundnut", filter: { type: "titleHas", keywords: ["groundnut"] } },
    { label: "Sesame", icon: "sesame", filter: { type: "titleHas", keywords: ["sesame"] } },
    { label: "Safflower", icon: "leaf", filter: { type: "titleHas", keywords: ["safflower"] } },
    { label: "Olive", icon: "olive", filter: { type: "titleHas", keywords: ["olive"] } },
    { label: "Mustard", icon: "mustard", filter: { type: "titleHas", keywords: ["mustard"] } },
    { label: "Coconut", icon: "coconut", filter: { type: "titleHas", keywords: ["coconut"] } },
  ];

  // ── GHEE ──────────────────────────────────────────────────────────────
  const ghee = products.filter(hasTag("ghee"));
  const gheeTabs: FocusSubTab[] = [{ label: "All ghee", icon: "brandMark", filter: { type: "all" } }];

  // ── HONEY ─────────────────────────────────────────────────────────────
  const honey = products.filter(hasTag("honey"));
  const honeyTabs: FocusSubTab[] = [{ label: "All honey", icon: "bee", filter: { type: "all" } }];

  // ── COMMUNITY FAVOURITES ──────────────────────────────────────────────
  // The real catalog has no "gifting"/"superfood" category, so this rail is the
  // highest-rated picks across the whole pantry — always populated, never demo.
  const favourites = [...products]
    .sort((a, b) => b.rating - a.rating || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, 10);
  const favouriteTabs: FocusSubTab[] = [
    { label: "All", icon: "brandMark", filter: { type: "all" } },
    { label: "Oils", icon: "oil", filter: { type: "tag", tags: ["oils", "oil"] } },
    { label: "Ghee", icon: "ghee", filter: { type: "tag", tags: ["ghee"] } },
    { label: "Honey", icon: "honey", filter: { type: "tag", tags: ["honey"] } },
  ];

  return (
    <main className="bg-page-warmth text-ng-ink">
      <PromoBar />
      <Header />
      <Hero promo={heroPromo} />
      <AssuranceStrip />
      <ShopByCategory
        className="section-glow-leaf overflow-hidden pt-14 md:pt-20"
        categories={categories}
        products={products}
      />

      <Why />
      {oils.length > 0 && (
        <ProductInFocus
          sectionId="pif-oils"
          accent="amber"
          eyebrow="Product in focus"
          heading={
            <>
              Explore our <em className="italic text-ng-leaf">cold-pressed oils</em>
            </>
          }
          description="Single-origin oils, pressed within seven days of dispatch and always bottled in glass. Pick your press."
          products={oils}
          subTabs={oilTabs}
          ctaHref="/shop/oils"
          ctaLabel="See all oils"
        />
      )}

      {/* The traceability lot-lookup that used to sit here now lives at
          /traceability, reached from the "See the proof" card in <OnlyPerfect>
          below. */}
      <NativeIngredients />
      {ghee.length > 0 && (
        <ProductInFocus
          sectionId="pif-ghee"
          accent="gold"
          eyebrow="Product in focus"
          heading={
            <>
              Explore our <em className="italic text-ng-leaf">A2 ghee</em>
            </>
          }
          description="Bilona-churned on the day the milk is collected, from named desi cows, and never bulk-boiled or blended."
          products={ghee}
          subTabs={gheeTabs}
          ctaHref="/shop/ghee"
          ctaLabel="See all ghee"
        />
      )}

      <Farms />
      {honey.length > 0 && (
        <ProductInFocus
          sectionId="pif-honey"
          accent="honey"
          eyebrow="Product in focus"
          heading={
            <>
              Pure, raw <em className="italic text-ng-leaf">honey</em>
            </>
          }
          description="Forest honey harvested without smoke and never heated. Every lot is lab-tested for purity."
          products={honey}
          subTabs={honeyTabs}
          ctaHref="/shop/honey"
          ctaLabel="See all honey"
        />
      )}

      <Testimonials />
      {favourites.length > 0 && (
        <ProductInFocus
          sectionId="pif-favourites"
          accent="forest"
          eyebrow="Loved by the community"
          heading={
            <>
              Community <em className="italic text-ng-leaf">favourites</em>
            </>
          }
          description="The single-origin staples our customers reorder most, ready to ship."
          products={favourites}
          subTabs={favouriteTabs}
          ctaHref="/shop"
          ctaLabel="Shop the full pantry"
        />
      )}

      <OnlyPerfect />
      <Journal />
      <Footer />
    </main>
  );
}
