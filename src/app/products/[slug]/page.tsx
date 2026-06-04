import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { ProductCard } from "@/components/ng/product-card";
import { Stars } from "@/components/ng/stars";
import { Reveal, Parallax } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";
import { PRODUCTS, FARMS, CATEGORIES } from "@/components/ng/data";
import type { ProductCard as Product, Farm } from "@/types/nutrigreenz";
import { Gallery } from "@/components/ng/pdp/gallery";
import { BuyBox } from "@/components/ng/pdp/buy-box";
import { TraceabilityPanel } from "@/components/ng/pdp/traceability-panel";
import { Reviews, type Review } from "@/components/ng/pdp/reviews";

const SITE = "https://nutrigreenz.in";
const PLACEHOLDER = "/images/placeholder.svg";

/* ---------------------------------- data helpers ---------------------------------- */

const TAG_TO_CATEGORY: Record<string, string> = {
  oil: "oils",
  ghee: "ghee",
  honey: "honey",
  millet: "millets",
  flour: "flours",
  superfood: "superfoods",
  spice: "spices",
  pulse: "pulses",
};

function getCategory(p: Product) {
  const tag = p.tags?.[0];
  const slug = tag ? (TAG_TO_CATEGORY[tag] ?? tag) : "pantry";
  const cat = CATEGORIES.find((c) => c.slug === slug);
  return { slug, title: cat?.title ?? "Pantry" };
}

/** Pick the most relevant partner farm for a product based on its category. */
function getFarm(p: Product): Farm {
  const tag = p.tags?.[0];
  if (tag === "ghee") return FARMS.find((f) => f.id === "f-junagadh") ?? FARMS[0];
  if (tag === "honey") return FARMS.find((f) => f.id === "f-nilgiri") ?? FARMS[0];
  return FARMS.find((f) => f.id === "f-anantapur") ?? FARMS[0];
}

/** Deterministic lot code derived from id so it is stable across renders. */
function getLotCode(p: Product): string {
  const digits = p.id.replace(/\D/g, "").padStart(4, "0");
  const seed = p.slug.length + p.reviewCount;
  return `NG-2605${digits.slice(-2)}-${String(seed % 10000).padStart(4, "0")}`;
}

function getHarvestDate(p: Product): string {
  const tag = p.tags?.[0];
  if (tag === "honey") return "Extracted 02 Mar 2026";
  if (tag === "ghee") return "Churned 24 May 2026";
  return "Pressed 18 Apr 2026";
}

function getDescription(p: Product): { intro: string; benefits: string[] } {
  const tag = p.tags?.[0];
  const benefitsByTag: Record<string, string[]> = {
    oil: [
      "Cold-pressed below 40°C — retains natural antioxidants and aroma",
      "Single-source, single-pass — no blending, no refining, no hexane",
      "Stored in UV-protected glass to preserve freshness",
      "Rich in good fats for everyday Indian cooking",
    ],
    ghee: [
      "Hand-churned Bilona method from A2 cultured curd",
      "Grainy texture and nutty aroma — the mark of true desi ghee",
      "High smoke point, ideal for tadka and deep frying",
      "From grass-fed indigenous cows, no synthetic feed",
    ],
    honey: [
      "Raw and unheated — enzymes and pollen left intact",
      "Harvested without smoke or queen-killing",
      "Lab-tested for purity, zero added sugar or syrup",
      "Naturally crystallises in cooler months — a sign of authenticity",
    ],
    millet: [
      "Naturally gluten-free, high in fibre and minerals",
      "Low glycaemic index — gentle on blood sugar",
      "Sun-dried and stone-cleaned, no polishing",
      "Sourced direct from dryland smallholder farms",
    ],
  };
  const introByTag: Record<string, string> = {
    oil: "Pressed slow and cold from a single farm lot, this oil keeps the flavour and nutrition that industrial refining strips away. You can taste the difference from the first tempering.",
    ghee: "Made the traditional Bilona way — curd is hand-churned to butter, then slow-simmered to golden ghee on the same day milk is collected. Nothing about it is hurried.",
    honey: "Wild, raw and traceable to a single forest harvest. We never heat or filter beyond straining, so everything the bees made stays in the jar.",
    millet: "An ancient grain, grown the way it always was — rain-fed, intercropped and minimally processed. A wholesome base for everyday meals.",
  };
  const fallback = [
    "Single-origin and fully traceable to the farm lot",
    "Minimally processed to retain natural nutrition",
    "Lab-tested for purity before it ships",
    "Sourced direct from our partner farmers",
  ];
  return {
    intro:
      introByTag[tag ?? ""] ??
      "Single-origin, minimally processed and traceable from farm to your kitchen. Real food, sourced with respect for the people who grow it.",
    benefits: benefitsByTag[tag ?? ""] ?? fallback,
  };
}

function getSpecs(p: Product, farm: Farm): { label: string; value: string }[] {
  const tag = p.tags?.[0];
  return [
    { label: "Net quantity", value: p.unit ?? "—" },
    { label: "Source farm", value: `${farm.name}, ${farm.region}` },
    { label: "Shelf life", value: tag === "honey" ? "24 months" : tag === "ghee" ? "12 months" : "9 months" },
    { label: "Storage", value: tag === "ghee" ? "Cool, dry place — no refrigeration" : "Away from direct sunlight" },
    { label: "FSSAI Lic.", value: "10024051000987" },
  ];
}

function getNutrition(p: Product): { label: string; value: string }[] {
  const tag = p.tags?.[0];
  if (tag === "ghee" || tag === "oil") {
    return [
      { label: "Energy", value: "900 kcal" },
      { label: "Total fat", value: "100 g" },
      { label: "Saturated fat", value: tag === "ghee" ? "62 g" : "18 g" },
      { label: "Trans fat", value: "0 g" },
      { label: "Cholesterol", value: tag === "ghee" ? "256 mg" : "0 mg" },
    ];
  }
  if (tag === "honey") {
    return [
      { label: "Energy", value: "304 kcal" },
      { label: "Carbohydrate", value: "82 g" },
      { label: "Total sugars", value: "80 g" },
      { label: "Added sugar", value: "0 g" },
      { label: "Protein", value: "0.3 g" },
    ];
  }
  return [
    { label: "Energy", value: "352 kcal" },
    { label: "Carbohydrate", value: "66 g" },
    { label: "Dietary fibre", value: "8 g" },
    { label: "Protein", value: "11 g" },
    { label: "Iron", value: "3.9 mg" },
  ];
}

const SAMPLE_REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Anjali R.",
    location: "Hyderabad",
    rating: 5,
    date: "12 May 2026",
    title: "The traceability is real",
    body: "I scanned the lot code on the label and actually saw the farm it came from. The quality is exceptional — this is now a pantry staple for us.",
    verified: true,
  },
  {
    id: "r2",
    name: "Rahul M.",
    location: "Mumbai",
    rating: 5,
    date: "28 Apr 2026",
    title: "Tastes like my grandmother's kitchen",
    body: "Switched our entire household over. The aroma when you open it tells you everything. Worth every rupee.",
    verified: true,
  },
  {
    id: "r3",
    name: "Priya K.",
    location: "Hyderabad",
    rating: 4,
    date: "15 Apr 2026",
    title: "Lovely product, heavy bottle",
    body: "Five stars on the contents. The glass packaging is premium but a little heavy and the cap is slightly fiddly. Minor gripe.",
    verified: true,
  },
];

/* ---------------------------------- SEO ---------------------------------- */

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) return { title: "Product not found · Nutri Greenz" };

  const cat = getCategory(p);
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
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) notFound();

  const cat = getCategory(p);
  const farm = getFarm(p);
  const lotCode = getLotCode(p);
  const harvestDate = getHarvestDate(p);
  const { intro, benefits } = getDescription(p);
  const specs = getSpecs(p, farm);
  const nutrition = getNutrition(p);
  const sameCat = PRODUCTS.filter((x) => x.id !== p.id && x.tags?.[0] === p.tags?.[0]);
  const relatedRail = (sameCat.length >= 4 ? sameCat : PRODUCTS.filter((x) => x.id !== p.id)).slice(0, 4);
  const discount = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;

  const images = [
    { src: p.image || PLACEHOLDER, alt: p.title },
    { src: PLACEHOLDER, alt: `${p.title} — packaging` },
    { src: PLACEHOLDER, alt: `${p.title} — texture` },
    { src: PLACEHOLDER, alt: `${p.title} — lot label` },
  ];

  // Variant chips derived from the base unit
  const variants = [{ label: p.unit?.split("·")[0]?.trim() || "Standard", priceDelta: 0 }];
  if (p.tags?.[0] === "oil") {
    variants.push({ label: "2L value pack", priceDelta: Math.round(p.price * 0.9) });
  } else if (p.tags?.[0] === "ghee") {
    variants.push({ label: "1L jar", priceDelta: Math.round(p.price * 0.85) });
  } else {
    variants.push({ label: "Family pack", priceDelta: Math.round(p.price * 0.8) });
  }

  const trust = [
    { icon: "test-tube-bold", label: "Lab-tested purity" },
    { icon: "shield-check-bold", label: "FSSAI certified" },
    { icon: "delivery-bold", label: "Free delivery over ₹599" },
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
      availability: "https://schema.org/InStock",
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

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-ng-line-soft bg-ng-paper">
        <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-5 py-3 text-[13px] text-ng-ink-muted md:px-8">
          <li>
            <Link href="/" className="transition-colors hover:text-ng-forest">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="transition-colors hover:text-ng-forest">
              Shop
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/shop?category=${cat.slug}`} className="transition-colors hover:text-ng-forest">
              {cat.title}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate font-medium text-ng-forest">{p.title}</li>
        </ol>
      </nav>

      {/* Hero: gallery + buy box */}
      <Section className="relative overflow-hidden !py-10 md:!py-14">
        {/* Soft parallax blobs behind the stage */}
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
              <Gallery images={images} badge={p.badge} badgeTone={p.badgeTone} discount={discount} />
            </Reveal>
          </div>

          <Reveal delay={0.08} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="ng-eyebrow text-ng-forest">{cat.title}</span>
              <h1 className="font-display text-[clamp(28px,4vw,44px)] leading-tight text-ng-forest-deep">{p.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Stars rating={p.rating} reviewCount={p.reviewCount} size="md" />
                <a href="#reviews" className="text-[13px] font-medium text-ng-leaf transition-colors hover:text-ng-forest">
                  Read reviews
                </a>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-cream px-3 py-1 font-mono text-[11px] tabular-nums text-ng-forest">
                  <Icon name="box-bold" size={12} className="text-ng-clay" />
                  Lot {lotCode}
                </span>
              </div>
            </div>

            <BuyBox title={p.title} basePrice={p.price} mrp={p.mrp} unit={p.unit} variants={variants} product={p} />

            {/* Trust strip */}
            <ul className="grid grid-cols-1 gap-3 rounded-2xl border border-ng-line-soft bg-ng-cream p-4 sm:grid-cols-3">
              {trust.map((t) => (
                <li key={t.label} className="flex items-center gap-2.5 text-[13px] font-medium text-ng-forest">
                  <Icon name={t.icon} size={20} className="text-ng-leaf" />
                  {t.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* Description + traceability */}
      <Section className="!pt-0">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <Reveal className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-2xl text-ng-forest-deep">About this product</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ng-ink">{intro}</p>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ng-ink-muted">Key benefits</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[14px] text-ng-ink">
                    <Icon name="leaf-bold" size={18} className="mt-0.5 shrink-0 text-ng-leaf" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <TraceabilityPanel lotCode={lotCode} farm={farm} harvestDate={harvestDate} labReportHref="#lab-report" />
          </Reveal>
        </div>
      </Section>

      {/* Nutrition + specs */}
      <Section className="!pt-0">
        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper shadow-[var(--shadow-ng-card)]">
              <div className="flex items-center gap-3 border-b border-ng-line-soft bg-ng-cream px-5 py-4">
                <Icon name="bottle-bold" size={20} className="text-ng-clay" />
                <h2 className="font-display text-xl text-ng-forest-deep">Nutrition</h2>
                <span className="ml-auto font-mono text-[11px] text-ng-ink-muted">per 100g / ml</span>
              </div>
              <table className="w-full text-[14px]">
                <tbody className="divide-y divide-ng-line-soft">
                  {nutrition.map((n) => (
                    <tr key={n.label} className="bg-ng-paper transition-colors hover:bg-ng-cream/40">
                      <td className="px-5 py-3 text-ng-ink-muted">{n.label}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-ng-forest-deep">{n.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper shadow-[var(--shadow-ng-card)]">
              <div className="flex items-center gap-3 border-b border-ng-line-soft bg-ng-cream px-5 py-4">
                <Icon name="clipboard-list-bold" size={20} className="text-ng-clay" />
                <h2 className="font-display text-xl text-ng-forest-deep">Specifications</h2>
              </div>
              <table className="w-full text-[14px]">
                <tbody className="divide-y divide-ng-line-soft">
                  {specs.map((s) => (
                    <tr key={s.label} className="bg-ng-paper transition-colors hover:bg-ng-cream/40">
                      <td className="px-5 py-3 text-ng-ink-muted">{s.label}</td>
                      <td className="px-5 py-3 text-right font-medium text-ng-forest-deep">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Reviews */}
      <Section
        id="reviews"
        className="bg-ng-sage/20 !py-16"
        eyebrow="Customer reviews"
        heading={<>What people <em className="italic text-ng-leaf">are saying</em></>}
      >
        <Reveal>
          <Reviews rating={p.rating} reviewCount={p.reviewCount} reviews={SAMPLE_REVIEWS} />
        </Reveal>
      </Section>

      {/* Related */}
      <Section
        eyebrow="You may also like"
        heading={<>More from the <em className="italic text-ng-leaf">pantry</em></>}
        description="Single-origin staples chosen by fellow shoppers — same lab-tested, lot-traceable promise."
      >
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {relatedRail.map((r) => (
            <ProductCard key={r.id} product={r} />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
