/**
 * Gallery panel content, per product.
 *
 * Everything a PDP gallery panel prints comes from here — copy, nutrition,
 * sourcing story, usage. One file so the same claim cannot say two things on
 * two panels, and so a correction lands everywhere at once.
 *
 * ── ON THE NUTRITION NUMBERS ──────────────────────────────────────────────
 * Two kinds of value live in the `nutrition` blocks:
 *
 *   FIXED    — true for any pure vegetable oil, by definition. 14 g of fat is
 *              126 kcal; a pure oil contains no cholesterol, sodium,
 *              carbohydrate or protein. These are not estimates.
 *
 *   PROVISIONAL — the fatty-acid split (saturated / MUFA / PUFA) and Vitamin E.
 *              These genuinely vary by seed, season and press, and the printed
 *              figures below are standard published values for the oil type,
 *              NOT a measurement of Nutri Greenz stock.
 *
 * Every provisional field is marked `coa: false`. When the lab COA arrives,
 * change the number and flip the flag — nothing else needs touching. The
 * renderer prints a "typical values" footnote while any field is uncertified,
 * because printing lab-looking figures that no lab produced is the kind of
 * claim an FSSAI audit exists to catch.
 */

export const BRAND = {
  name: "NUTRI GREENZ",
  // The wordmark, never the N monogram — client instruction.
  wordmark: "NUTRI GREENZ",
  tagline: "Born in Soil, built for tomorrow",
  site: "nutrigreenz.farm",
};

export const COLOR = {
  forest: "#14331F",
  forestDeep: "#0A1F12",
  forestSoft: "#1F4D2E",
  leaf: "#66BF73",
  sage: "#B2C7B2",
  cream: "#F5F2E0",
  creamDeep: "#ECE7D2",
  paper: "#FAFAF5",
  clay: "#B5862F",
  clayDeep: "#8A6420",
  ink: "#14331F",
  inkMuted: "#5C6A60",
};

/** Fixed for every pure vegetable oil — see the note above. */
const OIL_FIXED = {
  servingLabel: "1 Tbsp (14 g)",
  totalFatG: 14,
  caloriesKcal: 126,
  caloriesRda: "6.3%",
  totalFatRda: "21%",
  transFatG: 0,
  cholesterolMg: 0,
  sodiumMg: 0,
  carbsG: 0,
  fibreG: 0,
  sugarG: 0,
  addedSugarG: 0,
  proteinG: 0,
};

export const PRODUCTS = {
  "groundnut-oil": {
    slug: "groundnut-oil",
    category: "oils",
    title: "GROUNDNUT OIL",
    shortTitle: "Groundnut Oil",
    method: "COLD-PRESSED",
    // Wordmark-only render (no N monogram) — client instruction is that gallery
    // artwork carries the NUTRI GREENZ wordmark, never the single-letter mark.
    bottle: "/images/products/oils/groundnut-wordmark.webp",
    accent: "#B5862F",

    ingredientPanel: {
      heading: "Only One Ingredient",
      bullets: [
        "100% groundnuts, nothing else",
        "No bleaching, no deodorising",
        "Cloth-filtered, never chemically stripped",
      ],
    },

    sourcing: {
      // Nutri Greenz's own words. Placeholder regions until the client
      // confirms the actual sourcing districts — see PENDING at the bottom.
      lead: "Everything starts with the seed.",
      body: [
        "We buy groundnut by the lot, not by the tonne, from growers we can name.",
        "Sun-dried, hand-sorted and pressed within days of harvest — because oil",
        "carries whatever the seed brought with it.",
        "Slow-pressed on a wooden ghani so the oil never heats enough to lose",
        "its aroma. What reaches you smells like the nut it came from.",
      ],
      region: "From farms across Telangana and Andhra Pradesh",
    },

    usage: {
      modes: [
        { label: "Drizzle", img: "/images/products/oils/use-drizzle.webp" },
        { label: "Stir-Fry", img: "/images/products/oils/use-stirfry.webp" },
        { label: "Deep-Fry", img: "/images/products/oils/use-deepfry.webp" },
      ],
      notes: [
        "High smoke point — holds up to Indian deep-frying",
        "Everyday cooking: about 2–3 tsp per person, per day",
      ],
    },

    benefits: {
      heading: ["Native. Nutty.", "Nourishing."],
      items: [
        { label: "First-Press\nOnly", icon: "press" },
        { label: "High MUFA", icon: "drop" },
        { label: "Heart\nHealthy", icon: "heart" },
        { label: "Cholesterol\nFree", icon: "shield" },
      ],
    },

    comparison: {
      left: {
        title: "Cold-Pressed",
        points: [
          "Slow ghani pressing, no bleaching or deodorising",
          "Keeps Vitamin E, phytosterols and natural antioxidants",
          "Natural, nutty aroma",
          "Vibrant colour — the oil's own character",
        ],
      },
      right: {
        title: "Refined Oil",
        points: [
          "High-heat extraction with chemical refining",
          "Strips out nutrients and antioxidants",
          "Sharp, cooked smell",
          "Uniform pale colour, no natural lustre",
        ],
      },
    },

    nutrition: {
      ...OIL_FIXED,
      servingsPerContainer: { "1L": 65, "500ml": 32, "250ml": 16 },
      // PROVISIONAL — standard published values for groundnut oil.
      saturatedFatG: { value: 2.52, rda: "13%", coa: false },
      mufaG: { value: 6.44, coa: false },
      pufaG: { value: 4.9, coa: false },
      vitaminEMg: { value: 1.62, rda: "16%", coa: false },
    },
  },

  "a2-cow-ghee": {
    slug: "a2-cow-ghee",
    category: "ghee",
    title: "A2 DESI COW GHEE",
    shortTitle: "A2 Desi Cow Ghee",
    method: "BILONA-CHURNED",
    bottle: "/images/products/ghee/a2-gir-cow-ghee.webp",
    accent: "#B5862F",

    ingredientPanel: {
      heading: "Only One Ingredient",
      bullets: [
        "A2 desi cow milk, curd-set within hours",
        "Churned from curd — never from cream",
        "No colour, no preservative, no blending",
      ],
    },

    sourcing: {
      lead: "Ghee is made from curd. Most isn't.",
      body: [
        "We work with small herds, not dairies. The milk is set to curd the same",
        "day it is drawn, churned to butter, then simmered slowly until it clears.",
        "It is the long way round, and it is the only way to get the grain and the",
        "aroma people remember from home kitchens.",
        "Every batch is checked for purity before it is filled.",
      ],
      region: "From small herds across Telangana",
    },

    usage: {
      modes: [
        { label: "Tempering", img: "/images/products/ghee/ghee-lifestyle.webp" },
        { label: "Everyday Roti", img: "/images/products/ghee/ghee-jar-bowl.webp" },
        { label: "Sweets", img: "/images/products/ghee/ghee-benefit-bowl.webp" },
      ],
      notes: [
        "High smoke point — safe for tempering and frying",
        "Everyday use: about 1–2 tsp per person, per day",
      ],
    },

    benefits: {
      heading: ["Grainy. Golden.", "Grandmother-approved."],
      items: [
        { label: "Curd-Churned\nBilona", icon: "press" },
        { label: "A2 Desi\nMilk", icon: "drop" },
        { label: "Rich in\nVitamin A", icon: "heart" },
        { label: "No\nAdditives", icon: "shield" },
      ],
    },

    comparison: {
      left: {
        title: "Bilona Ghee",
        points: [
          "Churned from curd, the traditional way",
          "Grainy texture and deep, cooked-butter aroma",
          "Made in small batches from named herds",
          "Nothing added — no colour, no preservative",
        ],
      },
      right: {
        title: "Creamery Butter Ghee",
        points: [
          "Made directly from cream, skipping the curd stage",
          "Uniform, smooth texture with a flat aroma",
          "Pooled milk from unnamed sources",
          "Often colour-corrected for consistency",
        ],
      },
    },

    nutrition: {
      servingLabel: "1 tsp (5 g)",
      servingsPerContainer: { "1L": 200, "500ml": 100, "250ml": 50 },
      totalFatG: 5,
      caloriesKcal: 45,
      caloriesRda: "2.3%",
      totalFatRda: "7.5%",
      transFatG: 0,
      cholesterolMg: { value: 13, rda: "4%", coa: false },
      sodiumMg: 0,
      carbsG: 0,
      fibreG: 0,
      sugarG: 0,
      addedSugarG: 0,
      proteinG: 0,
      saturatedFatG: { value: 3.1, rda: "16%", coa: false },
      mufaG: { value: 1.4, coa: false },
      pufaG: { value: 0.2, coa: false },
      vitaminAMcg: { value: 40, rda: "5%", coa: false },
    },
  },
};

/**
 * Facts still owed by the client before these panels are press-final.
 *
 * Listed here rather than buried in a chat message, so whoever picks this up
 * next can see exactly what is provisional and why.
 */
export const PENDING = [
  "Lab COA — fatty-acid split and Vitamin E for each oil, and the ghee figures.",
  "Sourcing districts — the regions above are placeholders pending confirmation.",
  "Real customer reviews — the review panel is deliberately not built until these exist.",
  "FSSAI licence number and GS1 barcode, if these panels are ever reused for packaging.",
];
