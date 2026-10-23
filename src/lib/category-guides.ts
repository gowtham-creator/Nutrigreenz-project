import type { ProductCard } from "@/types/nutrigreenz";
import { searchName, sizeRange, variantsBySize } from "@/lib/product-seo";

/**
 * Buying guides for category and product pages.
 *
 * Written as short, self-contained answers under question headings, because
 * that is the passage Google and AI assistants lift into an answer. Every claim
 * is either general food knowledge or something the site already states (lab
 * testing, bilona churning, unheated honey). Nothing here quotes a figure we
 * cannot show.
 */

export interface GuideAnswer {
  question: string;
  answer: string;
}

export interface CategoryGuide {
  metaTitle: string;
  metaDescription: string;
  /** Page heading; the database category name stays the facet label. */
  h1: string;
  /** Opening answer, shown under the product grid. */
  answers: GuideAnswer[];
  /** Optional side-by-side comparison, rendered as a table. */
  comparison?: { question: string; columns: [string, string]; rows: [string, string, string][] };
  /** Heading for the "which one" list of this category's products. */
  chooseQuestion: string;
  /** One line per product slug: what it is and what it is for. */
  uses: Record<string, string>;
}

export const CATEGORY_GUIDES: Record<string, CategoryGuide> = {
  oils: {
    metaTitle: "Cold-Pressed & Wood-Pressed Oils | Nutri Greenz",
    metaDescription:
      "Buy cold-pressed and wood-pressed cooking oils online in Hyderabad: groundnut, sesame, coconut and more. Single-origin, lab-tested, never refined.",
    h1: "Cold-pressed and wood-pressed oils",
    answers: [
      {
        question: "What is cold-pressed oil?",
        answer:
          "Cold-pressed oil is pressed from seeds or nuts at a low temperature, with no chemical solvents, and then filtered instead of refined. Because it is never bleached or deodorised, it keeps the colour, aroma and more of the natural vitamin E of the seed. Wood-pressed oil, also called ganuga or kachi ghani oil, is cold-pressed in a slow wooden press.",
      },
      {
        question: "How should I store cold-pressed oil?",
        answer:
          "Keep the bottle or tin closed, away from sunlight and the heat of the stove, and use it within the best-before date on the pack. Cold-pressed oil has no added preservatives, so a little cloudiness or sediment at the bottom is normal and does not mean the oil has gone bad.",
      },
    ],
    comparison: {
      question: "Cold-pressed vs refined oil: what is the difference?",
      columns: ["Cold-pressed", "Refined"],
      rows: [
        ["How it is extracted", "Pressed mechanically at low temperature", "High heat and chemical solvents such as hexane"],
        ["After extraction", "Filtered", "Neutralised, bleached and deodorised"],
        ["Taste and smell", "The seed's own flavour", "Neutral"],
        ["Colour", "Natural, often darker", "Pale"],
        ["Shelf life", "Shorter; store away from light", "Longer"],
      ],
    },
    chooseQuestion: "Which cold-pressed oil should I buy?",
    uses: {
      "groundnut-cold-pressed-oil": "An everyday oil for Indian cooking, tadka and frying.",
      "sesame-cold-pressed-oil": "Gingelly oil for South Indian cooking, tempering and pickles.",
      "coconut-cold-pressed-oil": "For Kerala-style cooking, and also used on hair and skin.",
      "mustard-cold-pressed-oil": "Pungent and sharp, for Bengali and North Indian dishes and pickles.",
      "safflower-cold-pressed-oil": "A light, mild oil for everyday cooking.",
      "olive-cold-pressed-oil": "For salads, dressings and low-heat cooking.",
    },
  },
  ghee: {
    metaTitle: "A2 Gir Cow Ghee & Bilona Ghee | Nutri Greenz",
    metaDescription:
      "Buy A2 Gir cow ghee, bilona ghee and cultured buffalo ghee online in Hyderabad. Single-origin, lab-tested and traceable to the dairy.",
    h1: "A2 ghee and bilona ghee",
    answers: [
      {
        question: "What is A2 ghee?",
        answer:
          "A2 ghee is ghee made from the milk of cows that produce only the A2 type of beta-casein protein, such as India's Gir breed. Ordinary dairy milk usually mixes A1 and A2 protein. Ghee itself is butter simmered until the water cooks off and the milk solids separate, leaving clear, golden butterfat.",
      },
      {
        question: "What is bilona ghee?",
        answer:
          "Bilona ghee is made the traditional way: milk is set into curd, the curd is churned with a wooden bilona to separate the butter, and that butter is slowly simmered into ghee. Most commercial ghee skips the curd and is made straight from cream, which gives it a milder taste.",
      },
      {
        question: "How should I store ghee?",
        answer:
          "Ghee keeps well at room temperature in a closed jar. Use a dry spoon, because water and crumbs make it spoil sooner, and keep the jar out of direct sunlight. It may set solid in winter and turn liquid in summer; both are normal.",
      },
    ],
    chooseQuestion: "Which ghee should I choose?",
    uses: {
      "a2-gir-cow-ghee": "From the milk of Gir cows, which carries only A2 protein.",
      "vedic-bilona-ghee": "Churned from curd by the bilona method, then slow-simmered.",
      "cultured-buffalo-ghee": "From cultured buffalo-milk butter: whiter, richer and denser.",
      "pure-ghee": "An everyday ghee for cooking, tadka and sweets.",
    },
  },
  honey: {
    metaTitle: "Raw Honey: Forest, Acacia & Multifloral | Nutri Greenz",
    metaDescription:
      "Buy raw honey online in Hyderabad: wild forest, Kashmiri acacia and multifloral. Unheated, not ultra-filtered and lab-tested, with no added sugar.",
    h1: "Raw honey",
    answers: [
      {
        question: "What is raw honey?",
        answer:
          "Raw honey is honey that goes from the comb to the jar without being heated or ultra-filtered. It is strained only to remove wax and bits of comb, so it keeps its pollen, enzymes and natural aroma. Most supermarket honey is heated and finely filtered so that it stays clear and runny on the shelf.",
      },
      {
        question: "Why does raw honey crystallise?",
        answer:
          "Honey holds more sugar than water can normally dissolve, so its glucose slowly forms crystals, faster in cool weather. Crystallisation is natural and often a sign the honey has not been heated. To make it runny again, stand the closed jar in warm, not boiling, water and stir.",
      },
    ],
    chooseQuestion: "Which honey should I choose?",
    uses: {
      "wild-forest-honey": "From wild hives in forest areas: darker and full-flavoured.",
      "kashmiri-acacia-honey": "Pale, mild and slow to crystallise; good in tea and lemon water.",
      "multifloral-raw-honey": "From the nectar of many flowers; an everyday honey.",
      "raw-honey": "Everyday raw honey, unheated and not ultra-filtered.",
    },
  },
};

/** What the seed is called, for the oil definitions. */
const OIL_SOURCE: Record<string, string> = {
  groundnut: "groundnuts (peanuts)",
  sesame: "sesame seeds, also called gingelly or til",
  coconut: "dried coconut (copra)",
  mustard: "mustard seeds",
  safflower: "safflower seeds",
  olive: "olives",
};

/** Product-specific definitions, where general knowledge gives one. */
const PRODUCT_DEFINITION: Record<string, string> = {
  "a2-gir-cow-ghee":
    "A2 Gir cow ghee is ghee made from the milk of Gir cows, an Indian breed whose milk carries only the A2 type of beta-casein protein. The butter is simmered until the water cooks off, leaving golden butterfat with a nutty aroma.",
  "vedic-bilona-ghee":
    "Vedic bilona ghee is ghee made by the traditional bilona method: milk is set into curd, the curd is hand-churned with a wooden bilona to separate the butter, and the butter is slowly simmered into ghee.",
  "cultured-buffalo-ghee":
    "Cultured buffalo ghee is ghee made from buffalo-milk butter that is cultured, or lightly fermented, first, which gives it a deeper aroma. Buffalo ghee is whiter than cow ghee and has a rich, dense texture.",
  "pure-ghee":
    "Pure ghee is clarified butter: butter simmered until the water cooks off and the milk solids separate, leaving clear, golden butterfat for cooking, tadka and sweets.",
  "wild-forest-honey":
    "Wild forest honey is raw honey collected from wild bee colonies in forest areas, where the bees feed on many native trees and flowers. It is usually darker and stronger in flavour than farm honey, and it is not heated or ultra-filtered.",
  "kashmiri-acacia-honey":
    "Kashmiri acacia honey is raw honey made by bees from acacia blossoms in Kashmir. It is pale, mild and slow to crystallise, so it stays runny for longer than most honey.",
  "multifloral-raw-honey":
    "Multifloral raw honey is made from the nectar of many different flowers rather than one crop, so its colour and taste change a little with each harvest. It is unheated and not ultra-filtered.",
  "raw-honey":
    "Raw honey is honey that has not been heated or ultra-filtered, so it keeps its natural pollen, enzymes and aroma. It is strained only to remove wax and bits of comb.",
};

function definitionFor(p: ProductCard, categorySlug: string): string | null {
  const own = PRODUCT_DEFINITION[p.slug];
  if (own) return own;
  if (categorySlug === "oils") {
    const seed = Object.keys(OIL_SOURCE).find((k) => p.slug.startsWith(`${k}-`) || p.title.toLowerCase().startsWith(k));
    const name = searchName(p.title);
    const source = seed ? OIL_SOURCE[seed] : "seeds";
    return `${name} is oil pressed from ${source} at a low temperature, with no chemical solvents, and then filtered instead of refined. It keeps the colour, aroma and flavour of the ${seed ? "seed" : "source"}.`;
  }
  return CATEGORY_GUIDES[categorySlug]?.answers[0]?.answer ?? null;
}

/**
 * "What is {product}?" with a 40–80 word answer that stands on its own: what
 * it is, the sizes we sell, where we deliver and how it is checked.
 */
export function productAnswer(p: ProductCard, categorySlug: string): GuideAnswer | null {
  const definition = definitionFor(p, categorySlug);
  if (!definition) return null;
  const name = searchName(p.title);
  const sizes = sizeRange(variantsBySize(p).map((v) => v.label));
  const use = CATEGORY_GUIDES[categorySlug]?.uses[p.slug];
  const ours = `Nutri Greenz sells it${sizes ? ` in ${sizes} packs` : ""}, delivered across Hyderabad, and every lot is lab-tested before it ships.`;
  return {
    question: `What is ${name}?`,
    answer: [definition, categorySlug === "oils" && use ? use : null, ours].filter(Boolean).join(" "),
  };
}
