import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { ProductCard } from "@/components/ng/product-card";
import { Reveal, Parallax } from "@/components/ng/motion";
import { CATEGORIES } from "@/components/ng/data";
import type { ProductCard as Product, ProductVariantOption } from "@/types/nutrigreenz";
import { getStorefrontCatalog, getStorefrontProductBySlug } from "@/lib/storefront-catalog";
import { Gallery } from "@/components/ng/pdp/gallery";
import { BuyPanel } from "@/components/ng/pdp/buy-panel";
import { PdpVariantProvider } from "@/components/ng/pdp/variant-context";
import { TrustRow } from "@/components/ng/pdp/trust-row";
import { StorySection } from "@/components/ng/pdp/story-section";
import { TheWay } from "@/components/ng/pdp/the-way";
import { Uses } from "@/components/ng/pdp/uses";
import { Faq } from "@/components/ng/pdp/faq";
import { KnowYour } from "@/components/ng/pdp/know-your";
import { ReviewsSummary } from "@/components/ng/pdp/reviews-summary";
import { Certifications } from "@/components/ng/pdp/certifications";
import { ImpactBand } from "@/components/ng/pdp/impact-band";
import { StickyBar } from "@/components/ng/pdp/sticky-bar";
import type { Review } from "@/components/ng/pdp/reviews";
import type { PdpVariant } from "@/components/ng/pdp/variant-selector";
import { getPdpContent } from "@/components/ng/pdp/pdp-content";

const SITE = "https://nutrigreenz.in";
const PLACEHOLDER = "/images/placeholder.svg";
/** Reuse the storefront's "harvest" coupon deal across PDP offer/best-price strips. */
const COUPON_CODE = "HARVEST10";
const COUPON_PERCENT = 10;
const COUPON_MAX = 150;

/* ---------------------------------- data helpers ---------------------------------- */

function getCategoryMeta(p: Product, categoryId: string) {
  // Prefer the product's own category (its `tags` carry the real category slug
  // for live catalog rows); fall back to the sample category lookup by id/slug.
  const tagSlug = p.tags?.[0];
  const cat =
    CATEGORIES.find((c) => c.slug === tagSlug) ??
    CATEGORIES.find((c) => c.id === categoryId || c.slug === categoryId);
  if (cat) return { slug: cat.slug, title: cat.title };
  if (tagSlug) {
    const title = tagSlug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    return { slug: tagSlug, title };
  }
  return { slug: categoryId, title: "Pantry" };
}

/** Parse a numeric size + unit out of "500ml · Junagadh" → { qty: 500, unit: "ml" }. */
function parseSize(unit?: string): { qty: number; unit: string } | null {
  if (!unit) return null;
  const m = unit.match(/(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/i);
  if (!m) return null;
  return { qty: parseFloat(m[1]), unit: m[2].toLowerCase() };
}

/**
 * Derive 2–3 size variants deterministically from the base product price/unit.
 * Pricing scales linearly with size with a mild bulk discount on larger sizes.
 * The product's real unit is always present; `baseIndex` points at it so the
 * page can default-select the variant whose price matches the catalogue price.
 */
function deriveVariants(p: Product): { variants: PdpVariant[]; baseIndex: number } {
  const parsed = parseSize(p.unit);
  const perUnitLabel = (price: number, qty: number, unit: string) => {
    const each = price / qty;
    return `₹${each < 10 ? each.toFixed(2) : Math.round(each)} / ${unit}`;
  };

  // Base variant always exists.
  if (!parsed) {
    return {
      variants: [{ size: p.unit?.split("·")[0]?.trim() || "Standard", price: p.price, mrp: p.mrp, perUnit: "Best value" }],
      baseIndex: 0,
    };
  }

  const { qty, unit } = parsed;
  // Sensible step ladders per base unit type.
  const ladders: Record<string, number[]> = {
    ml: [250, 500, 1000],
    l: [0.5, 1, 2],
    g: [200, 500, 1000],
    kg: [0.5, 1, 5],
  };
  const ladder = ladders[unit] ?? [qty];
  // Keep the base size, plus up to two neighbouring sizes from the ladder.
  const sizesSet = new Set<number>([qty]);
  for (const s of ladder) {
    if (sizesSet.size >= 3) break;
    sizesSet.add(s);
  }
  const sizes = Array.from(sizesSet).sort((a, b) => a - b);
  const baseIndex = Math.max(0, sizes.indexOf(qty));

  const pretty = (n: number) => {
    if (unit === "l") return n < 1 ? `${n * 1000}ml` : `${n}L`;
    if (unit === "kg") return n < 1 ? `${n * 1000}g` : `${n}kg`;
    return `${n}${unit}`;
  };

  const variants = sizes.map((s) => {
    const ratio = s / qty;
    // The product's own size keeps its exact catalogue price; other sizes scale
    // linearly with a gentle per-unit discount on the larger packs.
    const bulk = ratio > 1 ? 1 - Math.min(0.12, (ratio - 1) * 0.05) : 1;
    const price = s === qty ? p.price : Math.round(p.price * ratio * bulk);
    const mrp = p.mrp ? Math.round(p.mrp * ratio) : undefined;
    return {
      size: pretty(s),
      price,
      mrp,
      perUnit: perUnitLabel(price, unit === "l" || unit === "kg" ? s * 1000 : s, unit === "l" ? "ml" : unit === "kg" ? "g" : unit),
    };
  });

  return { variants, baseIndex };
}

/** Map a real catalog variant → the PDP's selector/cart variant shape. */
function toBuyVariant(v: ProductVariantOption): PdpVariant {
  const each = v.sizeValue && v.sizeValue > 0 ? v.price / v.sizeValue : null;
  const unit = v.sizeUnit ?? "";
  const perUnit =
    each !== null && unit
      ? `₹${each < 10 ? each.toFixed(2) : Math.round(each)} / ${unit}`
      : v.pack
        ? v.pack.charAt(0).toUpperCase() + v.pack.slice(1)
        : "Best value";
  return {
    id: v.id,
    sku: v.sku || undefined,
    size: v.label,
    pack: v.pack,
    price: v.price,
    perUnit,
    inStock: v.inStock,
  };
}

/**
 * Resolve the PDP's variant list. DB-backed products drive the selector from
 * their real size × pack variants (cheapest in-stock pre-selected); demo/legacy
 * products with no variants fall back to deterministically derived sizes.
 */
function resolveVariants(p: Product): { variants: PdpVariant[]; baseIndex: number } {
  const real = p.variants ?? [];
  if (real.length > 0) {
    const variants = real.map(toBuyVariant);
    const firstInStock = variants.findIndex((v) => v.inStock !== false);
    return { variants, baseIndex: firstInStock >= 0 ? firstInStock : 0 };
  }
  return deriveVariants(p);
}

function getIntro(p: Product, categoryId: string): string {
  const byCat: Record<string, string> = {
    oils: "Pressed slow and cold from a single farm lot, this oil keeps the flavour and nutrition that industrial refining strips away. You can taste the difference from the very first tempering.",
    ghee: "Made the traditional Bilona way — curd is hand-churned to butter, then slow-simmered to golden ghee the same day the milk is collected. Nothing about it is hurried.",
    honey: "Wild, raw and traceable to a single forest harvest. We never heat or ultra-filter, so everything the bees made stays exactly where it belongs — in the jar.",
    millets: "An ancient grain grown the way it always was — rain-fed, intercropped and minimally processed. A wholesome, gluten-free base for everyday meals.",
    spices: "Single-origin whole spice, stone-ground in small batches so the aroma oils survive. Colour and fragrance you can smell the moment you open the pack.",
    superfoods: "Grown on partner farms, harvested at peak potency and gently milled so the goodness survives the journey to powder. A small spoon that does real work.",
    pulses: "Honest, unpolished dal from a single-origin farm — no water-polish, no oil coating. It cooks creamy and tastes of the pulse itself.",
    flours: "Stone-ground slowly on a traditional chakki so the grain stays cool and whole. Flour with the wheatgerm still in it — more flavour, more fibre.",
    fruits: "Ripened on the tree, picked to order and never gassed with carbide. Seasonal fruit that actually tastes the way it should.",
    gifting: "A curated hamper of our most-loved single-origin staples, in plastic-free packaging — a way to gift wellness you can stand behind, down to the farm.",
  };
  return (
    byCat[categoryId] ??
    "Single-origin, minimally processed and traceable from farm to your kitchen. Real food, sourced with respect for the people who grow it."
  );
}

const SAMPLE_REVIEWS: Review[] = [
  { id: "r1", name: "Anjali R.", location: "Hyderabad", rating: 5, date: "12 May 2026", title: "The traceability is real", body: "I scanned the lot code on the label and actually saw the farm it came from. The quality is exceptional — this is now a permanent pantry staple for us.", verified: true },
  { id: "r2", name: "Rahul M.", location: "Mumbai", rating: 5, date: "28 Apr 2026", title: "Tastes like my grandmother's kitchen", body: "Switched our entire household over. The aroma when you open it tells you everything you need to know. Worth every rupee.", verified: true },
  { id: "r3", name: "Priya K.", location: "Bengaluru", rating: 4, date: "15 Apr 2026", title: "Lovely product, premium packaging", body: "Five stars on the contents. The packaging is genuinely premium, a little heavy to handle but that's a minor gripe for this quality.", verified: true },
  { id: "r4", name: "Vikram S.", location: "Pune", rating: 5, date: "02 Apr 2026", title: "You can taste the freshness", body: "There's a freshness here you just don't get from supermarket brands. The difference was obvious from the first use.", verified: true },
  { id: "r5", name: "Meera D.", location: "Chennai", rating: 5, date: "21 Mar 2026", title: "Finally, food I trust", body: "Knowing exactly which farm my food came from changed how I shop. The whole family has switched over. Delivery was prompt too.", verified: true },
  { id: "r6", name: "Karan T.", location: "Delhi", rating: 4, date: "08 Mar 2026", title: "Great quality, would reorder", body: "Really happy with it overall. Would have liked a slightly larger size option but the standard pack is excellent value.", verified: true },
];

/* ---------------------------------- SEO ---------------------------------- */

// Re-fetch the product at most once a minute so Inventory-Portal edits (price,
// stock, status) appear on the PDP without a redeploy. Pages render on-demand
// and are cached/revalidated rather than pre-built, since live SKUs aren't known
// at build time.
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getStorefrontProductBySlug(slug);
  if (!p) return { title: "Product not found · Nutri Greenz" };

  const { categoryId } = getPdpContent(p);
  const cat = getCategoryMeta(p, categoryId);
  const title = `${p.title} · Nutri Greenz`;
  const description = `Buy ${p.title} (${p.unit ?? cat.title}) — single-origin, lab-tested and fully traceable to the farm. Rated ${p.rating}/5 by ${p.reviewCount.toLocaleString()} customers. Free delivery over ₹599.`;
  const url = `${SITE}/products/${p.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "Nutri Greenz",
      images: [{ url: p.image || PLACEHOLDER, alt: p.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [p.image || PLACEHOLDER],
    },
  };
}

/* ---------------------------------- page ---------------------------------- */

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, catalog] = await Promise.all([
    getStorefrontProductBySlug(slug),
    getStorefrontCatalog(),
  ]);
  if (!p) notFound();

  // The mapper stamps a "Sold out" badge when on-hand stock is depleted; that's
  // the storefront's stock signal, so add-to-cart is disabled in that state.
  const outOfStock = (p.badge ?? "").toLowerCase() === "sold out";

  const { categoryId, content } = getPdpContent(p);
  const cat = getCategoryMeta(p, categoryId);
  const intro = getIntro(p, categoryId);
  const { variants, baseIndex } = resolveVariants(p);
  const basePrice = variants[baseIndex]?.price ?? p.price;
  const discount = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;

  // Loyalty coins (deterministic: ~5% of base price, rounded to 5).
  const coins = Math.max(5, Math.round((basePrice * 0.05) / 5) * 5);
  // Best price after the harvest coupon (% off capped at COUPON_MAX).
  const couponOff = Math.min(COUPON_MAX, Math.round((basePrice * COUPON_PERCENT) / 100));
  const bestPrice = basePrice - couponOff;

  // Related rail — same category first, fill from the rest.
  const allProducts = catalog.products;
  const sameCat = allProducts.filter((x) => x.id !== p.id && getPdpContent(x).categoryId === categoryId);
  const others = allProducts.filter((x) => x.id !== p.id && getPdpContent(x).categoryId !== categoryId);
  const relatedRail = [...sameCat, ...others].slice(0, 4);

  const images = [
    { src: p.image || PLACEHOLDER, alt: p.title, label: "Front of pack" },
    { src: PLACEHOLDER, alt: `${p.title} — pack & label`, label: "Pack & label" },
    { src: PLACEHOLDER, alt: `${p.title} — texture & pour`, label: "Texture & pour" },
    { src: PLACEHOLDER, alt: `${p.title} — in the kitchen`, label: "In the kitchen" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: [`${SITE}${p.image || PLACEHOLDER}`],
    description: intro,
    sku: p.id,
    brand: { "@type": "Brand", name: "Nutri Greenz" },
    category: cat.title,
    offers: {
      "@type": "Offer",
      url: `${SITE}/products/${p.slug}`,
      priceCurrency: "INR",
      price: p.price,
      availability: outOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Share the selected size × pack between the buy panel and the sticky bar. */}
      <PdpVariantProvider variants={variants} initialIndex={baseIndex}>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-ng-line-soft bg-ng-paper">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-5 py-3 text-[13px] text-ng-ink-muted md:px-8">
          <li>
            <Link href="/" className="transition-colors hover:text-ng-forest">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="transition-colors hover:text-ng-forest">Shop</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/shop/${cat.slug}`} className="transition-colors hover:text-ng-forest">{cat.title}</Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate font-medium text-ng-forest">{p.title}</li>
        </ol>
      </nav>

      {/* 1 · Product hero — gallery (left) + buy panel (right) */}
      <Section className="relative overflow-hidden !py-10 md:!py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Parallax speed={0.4} className="absolute -left-32 top-10">
            <div className="h-96 w-96 rounded-full bg-ng-leaf/10 blur-3xl" />
          </Parallax>
          <Parallax speed={0.25} className="absolute -right-28 top-72">
            <div className="h-80 w-80 rounded-full bg-ng-clay/[0.06] blur-3xl" />
          </Parallax>
        </div>

        <div className="relative z-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Reveal>
              <Gallery images={images} badge={p.badge} badgeTone={p.badgeTone} discount={discount} produceIcon={content.produceIcon} />
            </Reveal>
          </div>

          <Reveal delay={0.08}>
            <BuyPanel
              product={p}
              categoryTitle={cat.title}
              credentials={content.credentials}
              variants={variants}
              initialIndex={baseIndex}
              coins={coins}
              coupon={{ code: COUPON_CODE, bestPrice, off: COUPON_PERCENT }}
              outOfStock={outOfStock}
            />
          </Reveal>
        </div>
      </Section>

      {/* 2 · Product description */}
      <Section className="!pt-0">
        <Reveal className="flex max-w-3xl flex-col gap-4">
          <h2 className="font-display text-2xl text-ng-forest-deep">About this {cat.title.toLowerCase()}</h2>
          <p className="text-[15px] leading-relaxed text-ng-ink">{intro}</p>
          <p className="text-[15px] leading-relaxed text-ng-ink">
            Every batch is traceable to a named partner farm and screened by an independent lab before it ships — so what
            reaches your kitchen is exactly what left the field, with nothing hidden in between.
          </p>
        </Reveal>
      </Section>

      {/* 3 · Trust row */}
      <Section className="!pt-0">
        <Reveal>
          <TrustRow checks={content.checks} />
        </Reveal>
      </Section>

      {/* 4 · Brand story */}
      <Section className="bg-ng-sage/15">
        <StorySection story={content.story} produceIcon={content.produceIcon} />
      </Section>

      {/* 5 · The Nutri Greenz Way */}
      <Section eyebrow={content.way.eyebrow} heading={<>{content.way.title}</>}>
        <TheWay cards={content.way.cards} />
      </Section>

      {/* 6 · Uses */}
      <Section className="!pt-0" eyebrow="Ways to use it" heading={<>{content.uses.title}</>}>
        <Uses intro={content.uses.intro} tips={content.uses.tips} icon={content.produceIcon} />
      </Section>

      {/* 7 · FAQ */}
      <Section
        className="bg-ng-cream-mesh bg-ng-cream"
        eyebrow="You ask, we answer"
        heading={<>Questions, <em className="italic text-ng-leaf">answered</em></>}
        align="center"
      >
        <Faq items={content.faq} />
      </Section>

      {/* 8 · Know your [category] */}
      <Section eyebrow="Compare the types" heading={<>{content.knowYour.title}</>}>
        <KnowYour data={content.knowYour} />
      </Section>

      {/* 9 · Customer reviews */}
      <Section
        id="reviews"
        className="bg-ng-sage/15 !py-16"
        eyebrow="Customer reviews"
        heading={<>What people <em className="italic text-ng-leaf">are saying</em></>}
      >
        <Reveal>
          <ReviewsSummary rating={p.rating} reviewCount={p.reviewCount} reviews={SAMPLE_REVIEWS} />
        </Reveal>
      </Section>

      {/* 10 · You may also like */}
      <Section
        eyebrow="You may also like"
        heading={<>More from the <em className="italic text-ng-leaf">{cat.title.toLowerCase()}</em></>}
        description="Single-origin staples chosen by fellow shoppers — same lab-tested, lot-traceable promise."
      >
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {relatedRail.map((r) => (
            <ProductCard key={r.id} product={r} />
          ))}
        </div>
      </Section>

      {/* 11 · Certifications */}
      <Section className="!pt-0" eyebrow="Certified & compliant" heading={<>Held to a <em className="italic text-ng-leaf">higher standard</em></>} align="center">
        <Reveal>
          <Certifications />
        </Reveal>
      </Section>

      {/* 12 · Impact stats band */}
      <Section className="!pt-0">
        <ImpactBand impact={content.impact} />
      </Section>

      {/* Sticky bottom add-to-cart bar */}
      <StickyBar product={p} price={basePrice} outOfStock={outOfStock} />

      </PdpVariantProvider>
    </PageShell>
  );
}
