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

/**
 * A row of finished art tiles (headline typeset ON the image, Anveshan-style):
 * "full" = one 16:9 banner, "2up" = two 4:5 tiles side by side.
 */
export interface StoryTileRow {
  layout: "full" | "2up";
  images: StoryImage[];
}

export interface ProductStoryContent {
  /** Category accent glyph used by image placeholders. */
  produceIcon: ProduceIconName;
  /** The "Product description" block — one or two short paragraphs of copy. */
  description: string[];
  /** Optional real marketing shots that drive the hero gallery (main + thumbs). */
  gallery?: StoryImage[];
  /**
   * Category-level detail shots appended AFTER the product's own hero image
   * when the category has no per-product `gallery` — e.g. the oils range shares
   * one set of pack/label/lifestyle shots across all six varieties.
   */
  sharedGallery?: StoryImage[];
  /** Ordered story blocks rendered below the description + trust bar. */
  sections: ProductStorySection[];
  /**
   * Finished story tiles with the copy baked into the artwork. When present
   * they REPLACE `sections` on the page (rendered as stacked image rows).
   */
  tiles?: StoryTileRow[];
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
    { src: `${GHEE_DIR}/ghee-hero.webp`, alt: "A2 Bilona Ghee jar", label: "Front of pack" },
    { src: `${GHEE_DIR}/tile-comparison.webp`, alt: "Nutri Greenz A2 Ghee vs ordinary ghee", label: "Ours vs ordinary" },
    { src: `${GHEE_DIR}/ghee-jar-bowl.webp`, alt: "A2 Bilona Ghee jar and bowl", label: "Jar & bowl" },
    { src: `${GHEE_DIR}/ghee-lifestyle.webp`, alt: "A2 Bilona Ghee poured in an Indian kitchen", label: "In the kitchen" },
  ],
  tiles: [
    {
      layout: "full",
      images: [{ src: `${GHEE_DIR}/tile-a2-verified.webp`, alt: "A2 protein verified — easily digestible, antioxidant-rich, nutrient-dense" }],
    },
    {
      layout: "2up",
      images: [
        { src: `${GHEE_DIR}/tile-curd-culture.webp`, alt: "Our own curd culture — your gut's best friend" },
        { src: `${GHEE_DIR}/tile-farm.webp`, alt: "Farm to spoon — sourced from trusted Indian farms" },
      ],
    },
    {
      layout: "full",
      images: [{ src: `${GHEE_DIR}/tile-tastes-like-home.webp`, alt: "Tastes like home — daanedaar texture, delicious taste" }],
    },
    {
      layout: "2up",
      images: [
        { src: `${GHEE_DIR}/tile-expert-approved.webp`, alt: "Expert approved — 70+ quality checks, no shortcuts" },
        { src: `${GHEE_DIR}/tile-adulteration-never.webp`, alt: "Adulteration? Never — hormone-free, dalda-free, heavy-metal free" },
      ],
    },
  ],
  sections: [
    {
      kind: "benefit-hero",
      heading: "Verified A2, naturally nourishing",
      sub: "A2 protein, verified at source — a ghee that earns its place in your kitchen by doing more for your body, not less.",
      image: { src: `${GHEE_DIR}/ghee-benefit-bowl.webp`, alt: "A top-down bowl of golden A2 Bilona Ghee", label: "Benefits" },
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
          image: { src: `${GHEE_DIR}/ghee-curd.webp`, alt: "Fresh curd set the traditional way", label: "Curd culture" },
        },
        {
          heading: "Farm to Spoon",
          sub: "Sourced straight from the fields of trusted Indian farms — milk to spoon, with nothing anonymous in between.",
          image: { src: `${GHEE_DIR}/ghee-farm.webp`, alt: "A2 Bilona Ghee sourced from Indian farms with Gir cows", label: "Farm sourced" },
        },
      ],
    },
    {
      kind: "wide-banner",
      heading: "Tastes Like Home",
      sub: "Daanedaar texture. Delicious taste. The grainy, golden ghee you remember from childhood kitchens — made the same slow way.",
      image: { src: `${GHEE_DIR}/ghee-lifestyle.webp`, alt: "Golden ghee poured into a brass kadai in an Indian kitchen", label: "Tastes like home" },
      imageSide: "left",
    },
    {
      kind: "split-2up",
      cards: [
        {
          heading: "Expert Approved",
          sub: "70+ quality checks and not a single shortcut. Every batch is screened end-to-end before it is ever sealed.",
          image: { src: `${GHEE_DIR}/ghee-lab.webp`, alt: "A2 Bilona Ghee lab-tested through 70+ quality checks", label: "Quality checks" },
        },
        {
          heading: "Adulteration? Never",
          sub: "Hormone-free. Dalda-free. Heavy-metal-free. Just pure A2 ghee — exactly as nature, and tradition, intended.",
          image: { src: `${GHEE_DIR}/ghee-nothing-else.webp`, alt: "Pure A2 Bilona Ghee — jar and bowl, nothing else", label: "Pure & trusted" },
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

const HONEY_DIR = "/images/products/honey";

const HONEY_STORY: ProductStoryContent = {
  produceIcon: "honey",
  description: [
    "Raw, single-forest honey — strained, never heated — so the pollen, enzymes and aroma the bees built stay exactly where they belong: in the jar.",
    "No added sugar, no syrup, no shortcuts. Just honey, the way the hive made it.",
  ],
  gallery: [
    { src: `${HONEY_DIR}/honey-hero.webp`, alt: "Wild Raw Honey jar", label: "Front of pack" },
    { src: `${HONEY_DIR}/honey-comparison.webp`, alt: "Nutri Greenz raw honey vs commercial honey", label: "Ours vs commercial" },
    { src: `${HONEY_DIR}/honey-jar-dipper.webp`, alt: "Wild Raw Honey jar with dipper and honeycomb", label: "Jar & dipper" },
  ],
  sections: [],
  tiles: [
    {
      layout: "full",
      images: [{ src: `${HONEY_DIR}/tile-raw.webp`, alt: "Raw, unheated, alive — natural enzymes intact, no added sugar, naturally crystallises" }],
    },
    {
      layout: "2up",
      images: [
        { src: `${HONEY_DIR}/tile-forests.webp`, alt: "From wild forests — ethically harvested from forest hives" },
        { src: `${HONEY_DIR}/tile-nosugar.webp`, alt: "No added sugar, ever — just honey, as the bees made it" },
      ],
    },
    {
      layout: "full",
      images: [{ src: `${HONEY_DIR}/tile-sweetener.webp`, alt: "Nature's own sweetener — straight from forest hives" }],
    },
  ],
};

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

const OILS_DIR = "/images/products/oils";

const OILS_STORY: ProductStoryContent = {
  produceIcon: "oil",
  description: [
    "Cold-pressed the traditional way — seeds crushed slowly on a wooden ghani, never heated or refined — so the oil keeps the aroma, colour and nutrients of the seed it came from.",
    "No bleaching, no deodorising, no chemicals at any step. Just small batches of unrefined oil, bottled as it leaves the press.",
  ],
  sharedGallery: [
    { src: `${OILS_DIR}/groundnut-side.webp`, alt: "Cold-pressed oil bottle — pack and label detail", label: "Pack & label" },
    { src: `${OILS_DIR}/oils-infographic.webp`, alt: "Why our cold-pressed oil — first press, cholesterol free, rich in omega 6", label: "Why our oil" },
    { src: `${OILS_DIR}/oils-lifestyle.webp`, alt: "Cold-pressed oil poured in an Indian kitchen", label: "In the kitchen" },
    { src: `${OILS_DIR}/oils-tile-sizes.webp`, alt: "Every pack size — bottles, jars and the 15L tin", label: "All pack sizes" },
  ],
  sections: [],
  tiles: [
    {
      layout: "full",
      images: [{ src: `${OILS_DIR}/oils-tile-why.webp`, alt: "Why cold-pressed — zero trans fat, nutrients kept alive, no chemicals" }],
    },
    {
      layout: "2up",
      images: [
        { src: `${OILS_DIR}/oils-tile-comparison.webp`, alt: "Nutri Greenz cold-pressed vs refined oil" },
        { src: `${OILS_DIR}/oils-tile-woodpress.webp`, alt: "Wood-pressed slowly on a traditional ghani" },
      ],
    },
    {
      layout: "full",
      images: [{ src: `${OILS_DIR}/oils-tile-range.webp`, alt: "The Nutri Greenz cold-pressed oil range — six varieties" }],
    },
  ],
};

/* ──────────────────────────────── the registry ──────────────────────────────── */

/**
 * Per-category story content, keyed by category slug. Oils are registered under
 * both the resolved category id (`oils`, the live catalog category slug) and the
 * "cold-pressed-oils" alias, so the story resolves regardless of which slug the
 * PDP passes to `getProductStory(categoryId, cat.slug)`.
 */
export const PRODUCT_STORY: Record<string, ProductStoryContent> = {
  ghee: GHEE_STORY,
  honey: HONEY_STORY,
  rice: RICE_STORY,
  oils: OILS_STORY,
  "cold-pressed-oils": OILS_STORY,
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
