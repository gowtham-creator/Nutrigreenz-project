import type { ProduceIconName } from "@/components/ng/produce-icons";

/**
 * pdp-story — the per-category editorial "story" model for the product page.
 *
 * Where `pdp-content.ts` drives the generic, always-present sections (trust,
 * brand story, the way, FAQ, comparison …), this file drives the richer,
 * image-led story blocks that sit directly below the buy panel: a product
 * description, a benefit hero, two side-by-side splits and a wide banner.
 *
 * The STRUCTURE is generic (the same `ProductStorySection` union renders every
 * category); only the COPY and IMAGERY change per category. Ghee is authored in
 * full; honey / rice / oils carry minimal placeholder entries so a page never
 * breaks while real photography and copy are still being produced. A category
 * with no entry simply renders no story blocks (the page degrades gracefully).
 */

/** A placeholder image src that the story components fall back to a branded glyph for. */
export const STORY_PLACEHOLDER = "/images/placeholder.svg";

export interface StoryImage {
  src: string;
  alt: string;
  /** Short caption shown on the branded placeholder until a real photo exists. */
  label?: string;
}

export interface StoryBullet {
  /** Thin Solar "line" icon name, e.g. "shield-check-linear". */
  icon: string;
  label: string;
}

/**
 * BENEFIT-HERO — a rounded cream card: image on the left, a big heading + a
 * short supporting line + up to three line-icon "shield" bullets on the right.
 */
export interface BenefitHeroSection {
  kind: "benefit-hero";
  heading: string;
  sub: string;
  image: StoryImage;
  bullets: StoryBullet[];
}

export interface SplitCard {
  heading: string;
  sub: string;
  image: StoryImage;
}

/** SPLIT 2-UP — two side-by-side cards, each with a heading, sub and image. */
export interface Split2UpSection {
  kind: "split-2up";
  cards: [SplitCard, SplitCard];
}

/**
 * WIDE BANNER — a full-width forest-green band: an image on one side and a big
 * cream heading + sub on the other.
 */
export interface WideBannerSection {
  kind: "wide-banner";
  heading: string;
  sub: string;
  image: StoryImage;
  /** Which side the image sits on at desktop. Defaults to "left". */
  imageSide?: "left" | "right";
}

/** A discriminated union of every story block variant the page can render. */
export type ProductStorySection =
  | BenefitHeroSection
  | Split2UpSection
  | WideBannerSection;

export interface ProductStoryContent {
  /** Category accent glyph used by image placeholders. */
  produceIcon: ProduceIconName;
  /** The "Product description" block — one or two short paragraphs of copy. */
  description: string[];
  /** Optional real marketing shots that drive the hero gallery (main + thumbs). */
  gallery?: StoryImage[];
  /** Ordered story blocks rendered below the description + trust bar. */
  sections: ProductStorySection[];
}

/* ──────────────────────────────────── GHEE ──────────────────────────────────── */

const GHEE_DIR = "/images/products/ghee";

const GHEE_STORY: ProductStoryContent = {
  produceIcon: "ghee",
  description: [
    "Made on Indian farms, our A2 Bilona Ghee is the epitome of purity — Bilona hand-churned from A2 cow curd, not cream.",
    "Light on the gut and rich in nutrients and heart-healthy fats, it carries no hidden ingredients and takes no shortcuts. Just slow, traditional craft, the way ghee was always meant to be made.",
  ],
  gallery: [
    { src: `${GHEE_DIR}/ghee-hero-logoabove-1.webp`, alt: "A2 Bilona Ghee jar", label: "Front of pack" },
    { src: `${GHEE_DIR}/ghee-02-side-view.webp`, alt: "A2 Bilona Ghee — side view", label: "Pack & label" },
    { src: `${GHEE_DIR}/ghee-04-lifestyle.webp`, alt: "A2 Bilona Ghee in the kitchen", label: "In the kitchen" },
    { src: `${GHEE_DIR}/ghee-09-card-nothing-else.webp`, alt: "A2 Bilona Ghee — nothing else added", label: "Nothing else added" },
  ],
  sections: [
    {
      kind: "benefit-hero",
      heading: "Verified A2, naturally nourishing",
      sub: "A2 protein, verified at source — a ghee that earns its place in your kitchen by doing more for your body, not less.",
      image: { src: `${GHEE_DIR}/ghee-05-card-benefits.webp`, alt: "A2 Bilona Ghee benefits", label: "Benefits" },
      bullets: [
        { icon: "shield-check-linear", label: "Easily digestible" },
        { icon: "leaf-linear", label: "Antioxidant-rich" },
        { icon: "verified-check-linear", label: "Nutrient-dense" },
      ],
    },
    {
      kind: "split-2up",
      cards: [
        {
          heading: "Our Own Curd Culture",
          sub: "Your gut's best friend. We set fresh curd in-house with our own living culture, then churn — so the ghee is gentle and easy to digest.",
          image: { src: `${GHEE_DIR}/ghee-06-card-usage.webp`, alt: "Curd cultured the traditional way", label: "Curd culture" },
        },
        {
          heading: "Farm to Spoon",
          sub: "Sourced straight from the fields of trusted Indian farms — milk to spoon, with nothing anonymous in between.",
          image: { src: `${GHEE_DIR}/ghee-02-side-view.webp`, alt: "A2 Bilona Ghee sourced from Indian farms", label: "Farm sourced" },
        },
      ],
    },
    {
      kind: "wide-banner",
      heading: "Tastes Like Home",
      sub: "Daanedaar texture. Delicious taste. The grainy, golden ghee you remember from childhood kitchens — made the same slow way.",
      image: { src: `${GHEE_DIR}/ghee-04-lifestyle.webp`, alt: "A2 Bilona Ghee, grainy and golden", label: "Daanedaar texture" },
      imageSide: "left",
    },
    {
      kind: "split-2up",
      cards: [
        {
          heading: "Expert Approved",
          sub: "70+ quality checks and not a single shortcut. Every batch is screened end-to-end before it is ever sealed.",
          image: { src: `${GHEE_DIR}/ghee-07-card-comparison.webp`, alt: "A2 Bilona Ghee passes 70+ quality checks", label: "Quality checks" },
        },
        {
          heading: "Adulteration? Never",
          sub: "Hormone-free. Dalda-free. Heavy-metal-free. Just pure A2 ghee — exactly as nature, and tradition, intended.",
          image: { src: `${GHEE_DIR}/ghee-08-card-trust.webp`, alt: "A2 Bilona Ghee, free from adulteration", label: "Pure & trusted" },
        },
      ],
    },
  ],
};

/* ───────────────────── minimal placeholders (honey / rice / oils) ───────────────────── */

/**
 * Build a minimal, never-break story entry for a category whose photography and
 * final copy are still in production. Images fall back to the branded glyph.
 */
function minimalStory(
  produceIcon: ProduceIconName,
  description: string[],
  hero: { heading: string; sub: string; bullets: StoryBullet[] },
  split: { a: { heading: string; sub: string }; b: { heading: string; sub: string } },
): ProductStoryContent {
  return {
    produceIcon,
    description,
    sections: [
      {
        kind: "benefit-hero",
        heading: hero.heading,
        sub: hero.sub,
        image: { src: STORY_PLACEHOLDER, alt: `${hero.heading} visual`, label: "Photo coming soon" },
        bullets: hero.bullets,
      },
      {
        kind: "split-2up",
        cards: [
          { heading: split.a.heading, sub: split.a.sub, image: { src: STORY_PLACEHOLDER, alt: split.a.heading, label: "Photo coming soon" } },
          { heading: split.b.heading, sub: split.b.sub, image: { src: STORY_PLACEHOLDER, alt: split.b.heading, label: "Photo coming soon" } },
        ],
      },
    ],
  };
}

const HONEY_STORY = minimalStory(
  "honey",
  [
    "Raw, single-forest honey — strained, never heated — so the pollen, enzymes and aroma the bees built stay exactly where they belong: in the jar.",
    "No added sugar, no syrup, no shortcuts. Just honey, the way the hive made it.",
  ],
  {
    heading: "Pure by every measure",
    sub: "Living, raw honey traced to a single forest harvest.",
    bullets: [
      { icon: "shield-check-linear", label: "Raw & unheated" },
      { icon: "leaf-linear", label: "Single-forest source" },
      { icon: "verified-check-linear", label: "No added sugar" },
    ],
  },
  {
    a: { heading: "Strained, Never Boiled", sub: "Gently strained so the natural enzymes and pollen stay alive in every spoon." },
    b: { heading: "Traced to the Forest", sub: "Each jar comes from one forest harvest, never bulk-blended from many sources." },
  },
);

const RICE_STORY = minimalStory(
  "grain",
  [
    "Aged, single-origin rice grown the unhurried way and milled with a light touch — so each grain keeps its aroma, bite and natural goodness.",
    "No polishing for looks, no shortcuts for shelf-life. Just honest rice that cooks the way it should.",
  ],
  {
    heading: "Pure by every measure",
    sub: "Naturally grown, minimally milled, single-origin rice.",
    bullets: [
      { icon: "shield-check-linear", label: "Lightly milled" },
      { icon: "leaf-linear", label: "Naturally aged" },
      { icon: "verified-check-linear", label: "Single-origin" },
    ],
  },
  {
    a: { heading: "Aged for Flavour", sub: "Rested after harvest so the grains firm up and cook fluffy, never sticky." },
    b: { heading: "Farm to Grain", sub: "Sourced from named paddy farms and traceable back to the field it grew in." },
  },
);

const OILS_STORY = minimalStory(
  "oil",
  [
    "Single-farm seed, pressed slow and cold on a wooden ghani — no heat, no hexane, no refining — so the oil still tastes of the seed it came from.",
    "Bottled in UV-protected glass so the aroma reaches your kitchen exactly as it left the press.",
  ],
  {
    heading: "Pure by every measure",
    sub: "Cold-pressed below 40°C, from a single farm lot.",
    bullets: [
      { icon: "shield-check-linear", label: "Cold-pressed" },
      { icon: "leaf-linear", label: "No refining" },
      { icon: "verified-check-linear", label: "Glass-bottled" },
    ],
  },
  {
    a: { heading: "Slow, Cold Press", sub: "Pressed below 40°C so the natural antioxidants and vitamin E survive intact." },
    b: { heading: "One Farm, One Lot", sub: "Never blended across regions — scan the lot code to see the exact farm and press date." },
  },
);

/* ──────────────────────────────── the registry ──────────────────────────────── */

/** Per-category story content, keyed by category slug. */
export const PRODUCT_STORY: Record<string, ProductStoryContent> = {
  ghee: GHEE_STORY,
  honey: HONEY_STORY,
  rice: RICE_STORY,
  oils: OILS_STORY,
};

/**
 * Resolve the story content for a product. Tries each provided key in order
 * (e.g. the resolved category id, then the breadcrumb category slug) and
 * returns the first match, or `null` when the category has no story authored.
 */
export function getProductStory(...keys: (string | undefined)[]): ProductStoryContent | null {
  for (const key of keys) {
    if (key && PRODUCT_STORY[key]) return PRODUCT_STORY[key];
  }
  return null;
}
