import { PromoBar } from "@/components/ng/promo-bar";
import { Header } from "@/components/ng/header";
import { Footer } from "@/components/ng/footer";
import { Hero } from "@/components/ng/sections/hero";
import { AssuranceStrip } from "@/components/ng/sections/assurance-strip";
import { ShopByCategory } from "@/components/ng/sections/shop-by-category";
import { Why } from "@/components/ng/sections/why";
import { Traceability } from "@/components/ng/sections/traceability";
import { ProductInFocus, type FocusSubTab } from "@/components/ng/sections/product-in-focus";
import { Farms } from "@/components/ng/sections/farms";
import { Testimonials } from "@/components/ng/sections/testimonials";
import { Journal } from "@/components/ng/sections/journal";
import { CommunityCTA } from "@/components/ng/sections/community-cta";
import { PRODUCTS } from "@/components/ng/data";

/** Tag helper for building each section's product pool (runs on the server). */
const hasTag =
  (...tags: string[]) =>
  (p: (typeof PRODUCTS)[number]) =>
    p.tags?.some((t) => tags.includes(t)) ?? false;

export default function Home() {
  // ── OILS ──────────────────────────────────────────────────────────────
  // Sub-tab `filter`s are serializable descriptors (no functions) so they can
  // cross the Server → Client boundary into <ProductInFocus>.
  const oils = PRODUCTS.filter(hasTag("oil"));
  const oilTabs: FocusSubTab[] = [
    { label: "All oils", icon: "oil", filter: { type: "all" } },
    { label: "Groundnut", icon: "seedling", filter: { type: "titleHas", keywords: ["groundnut"] } },
    { label: "Sunflower", icon: "leaf", filter: { type: "titleHas", keywords: ["sunflower"] } },
    { label: "Coconut", icon: "fruit", filter: { type: "titleHas", keywords: ["coconut"] } },
    { label: "Sesame", icon: "grain", filter: { type: "titleHas", keywords: ["sesame"] } },
    { label: "Mustard", icon: "spice", filter: { type: "titleHas", keywords: ["mustard"] } },
  ];

  // ── A2 GHEE ───────────────────────────────────────────────────────────
  const ghee = PRODUCTS.filter(hasTag("ghee"));
  const gheeTabs: FocusSubTab[] = [
    { label: "All ghee", icon: "ghee", filter: { type: "all" } },
    { label: "Gir cow", icon: "milk", filter: { type: "titleHas", keywords: ["gir"] } },
    { label: "Desi cow", icon: "milk", filter: { type: "titleHas", keywords: ["desi", "sahiwal"] } },
    { label: "Buffalo", icon: "milk", filter: { type: "titleHas", keywords: ["buffalo"] } },
    { label: "Cultured", icon: "ghee", filter: { type: "titleHas", keywords: ["cultured", "vedic", "bilona"] } },
  ];

  // ── HONEY & SUPERFOODS ────────────────────────────────────────────────
  const honeySuperfoods = PRODUCTS.filter(hasTag("honey", "superfood"));
  const honeyTabs: FocusSubTab[] = [
    { label: "All", icon: "leaf", filter: { type: "all" } },
    { label: "Honey", icon: "honey", filter: { type: "tag", tags: ["honey"] } },
    { label: "Superfoods", icon: "seedling", filter: { type: "tag", tags: ["superfood"] } },
  ];

  // ── GIFTING & COMBOS ──────────────────────────────────────────────────
  // Gifting hampers first, topped up with the highest-rated bestsellers.
  const gifting = PRODUCTS.filter(hasTag("gifting"));
  const giftingIds = new Set(gifting.map((p) => p.id));
  const topPicks = PRODUCTS.filter((p) => !giftingIds.has(p.id)).sort((a, b) => b.rating - a.rating);
  const giftingAndBest = [...gifting, ...topPicks].slice(0, 10);
  const giftingTabs: FocusSubTab[] = [
    { label: "All", icon: "gift", filter: { type: "all" } },
    { label: "Hampers", icon: "gift", filter: { type: "titleHas", keywords: ["hamper", "sampler"] } },
    { label: "Wellness boxes", icon: "leaf", filter: { type: "titleHas", keywords: ["box", "wellness"] } },
    { label: "Bestsellers", icon: "seedling", filter: { type: "bestseller", minRating: 4.7 } },
  ];

  return (
    <main className="bg-page-warmth text-ng-ink">
      <PromoBar />
      <Header />
      <Hero />
      <AssuranceStrip />
      <ShopByCategory className="section-glow-leaf overflow-hidden pt-14 md:pt-20" />

      <Why />
      <ProductInFocus
        sectionId="pif-oils"
        accent="amber"
        eyebrow="Product in focus"
        heading={
          <>
            Explore our <em className="italic text-ng-leaf">cold-pressed oils</em>
          </>
        }
        description="Single-origin, pressed within seven days of dispatch. Always glass, never plastic — pick your press."
        products={oils}
        subTabs={oilTabs}
        ctaHref="/shop/oils"
        ctaLabel="See all oils"
      />

      <Traceability />
      <ProductInFocus
        sectionId="pif-ghee"
        accent="gold"
        eyebrow="Product in focus"
        heading={
          <>
            Explore our <em className="italic text-ng-leaf">A2 ghee</em>
          </>
        }
        description="Bilona-churned the same day the milk is collected, from named desi cows — never bulk-boiled, never blended."
        products={ghee}
        subTabs={gheeTabs}
        ctaHref="/shop/ghee"
        ctaLabel="See all ghee"
      />

      <Farms />
      <ProductInFocus
        sectionId="pif-honey"
        accent="honey"
        eyebrow="Product in focus"
        heading={
          <>
            Honey &amp; <em className="italic text-ng-leaf">superfoods</em>
          </>
        }
        description="Forest honey harvested without smoke and sun-dried superfoods — every lot is lab-tested for purity."
        products={honeySuperfoods}
        subTabs={honeyTabs}
        ctaHref="/shop/honey"
        ctaLabel="See all honey & superfoods"
      />

      <Testimonials />
      <ProductInFocus
        sectionId="pif-gifting"
        accent="forest"
        eyebrow="Product in focus"
        heading={
          <>
            Gifting &amp; <em className="italic text-ng-leaf">combos</em>
          </>
        }
        description="Hand-packed gift boxes and the crowd-favourites our community reorders most — ready to gift or keep."
        products={giftingAndBest}
        subTabs={giftingTabs}
        ctaHref="/shop/gifting"
        ctaLabel="See all gifting"
      />

      <Journal />
      <CommunityCTA />
      <Footer />
    </main>
  );
}
