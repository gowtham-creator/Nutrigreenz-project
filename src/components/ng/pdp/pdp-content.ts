import type { ProductCard } from "@/types/nutrigreenz";
import type { ProduceIconName } from "@/components/ng/produce-icons";

/**
 * pdp-content — the category-aware content engine for the product detail page.
 *
 * Every product page resolves to ONE `PdpCategoryContent` based on the product's
 * `tags`. That content drives the credential chips, the "trust" points, the brand
 * story, "The Nutri Greenz Way" cards, usage tips, the FAQ, and the "Know your X"
 * comparison — so a ghee page reads like ghee and an oil page reads like oil,
 * while every category (even thin ones) gets a complete, premium page via DEFAULT.
 *
 * Resolution: tags → categoryId (TAG_TO_CATEGORY) → PDP_CONTENT[categoryId].
 */

/* ─────────────────────────── category resolution ─────────────────────────── */

export type PdpCategoryId =
  | "oils"
  | "ghee"
  | "honey"
  | "millets"
  | "spices"
  | "superfoods"
  | "pulses"
  | "flours"
  | "fruits"
  | "gifting";

/** tag (on a product) → category id used to pick PDP content. */
export const TAG_TO_CATEGORY: Record<string, PdpCategoryId> = {
  oil: "oils",
  ghee: "ghee",
  honey: "honey",
  millet: "millets",
  spice: "spices",
  superfood: "superfoods",
  pulse: "pulses",
  flour: "flours",
  fruit: "fruits",
  gifting: "gifting",
};

/** Resolve a product's PDP category id from its tags (first matching tag wins). */
export function resolveCategoryId(product: Pick<ProductCard, "tags">): PdpCategoryId {
  for (const tag of product.tags ?? []) {
    const cat = TAG_TO_CATEGORY[tag];
    if (cat) return cat;
  }
  return "oils";
}

/* ─────────────────────────────── content types ───────────────────────────── */

/**
 * An optional REAL product photo for a content slot. When present, the section
 * renders a next/image (object-cover) instead of the themed illustrated
 * placeholder — so categories with real photography (oils, ghee, honey) show
 * their shots, while categories still awaiting photos keep the on-brand
 * placeholder. Paths point at existing assets under `public/images/products/`.
 */
export interface PdpImage {
  src: string;
  alt: string;
}

export interface WayCard {
  icon: string; // Solar icon name
  title: string;
  body: string;
  points: string[];
  /** Real header photo; falls back to the illustrated tint + icon when absent. */
  image?: PdpImage;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface UseTip {
  /** bold key phrase */
  key: string;
  /** remaining sentence */
  rest: string;
}

export interface KnowYourType {
  name: string;
  icon: ProduceIconName;
  /** ordered values matching `KnowYour.rows` */
  values: string[];
}

export interface KnowYour {
  /** heading e.g. "Know your ghee" */
  title: string;
  intro: string;
  /** row labels, e.g. ["Flavour", "Texture", "Best for", "Benefit"] */
  rows: string[];
  types: KnowYourType[];
}

export interface ImpactStat {
  value: string;
  label: string;
  icon: string;
}

export interface PdpCategoryContent {
  /** category accent produce icon for story/illustration tinting */
  produceIcon: ProduceIconName;
  /** one-line credential chips for the hero credential strip */
  credentials: string[];
  /** how many quality checks this category runs (used in trust + certs copy) */
  checks: number;
  /** 4 trust-row items (free shipping / support / returns / N checks) */
  story: { eyebrow: string; title: string; body: string[]; image?: PdpImage };
  way: { eyebrow: string; title: string; cards: WayCard[] };
  uses: { title: string; intro: string; tips: UseTip[]; image?: PdpImage };
  faq: FaqItem[];
  knowYour: KnowYour;
  impact: { title: string; subtitle: string; stats: ImpactStat[] };
}

/* ───────────────────────────── shared fragments ──────────────────────────── */

const IMPACT_BASE: ImpactStat[] = [
  { value: "42", label: "Partner farms", icon: "home-smile-bold" },
  { value: "500+", label: "Lots fully traced", icon: "map-point-wave-bold" },
  { value: "70+", label: "Quality checks", icon: "test-tube-bold" },
  { value: "12,400+", label: "Households fed", icon: "users-group-rounded-bold" },
];

function impact(subtitle: string): PdpCategoryContent["impact"] {
  return { title: "Healthier families, happier farmers", subtitle, stats: IMPACT_BASE };
}

/* ──────────────────────────────── DEFAULT ────────────────────────────────── */

const DEFAULT_CONTENT: PdpCategoryContent = {
  produceIcon: "leaf",
  credentials: ["Single-origin", "Lab-tested", "Minimally processed", "70+ checks"],
  checks: 70,
  story: {
    eyebrow: "Our story",
    title: "From our farms to your kitchen",
    body: [
      "Every Nutri Greenz staple starts on a named partner farm, not in an anonymous warehouse. We pay farmers fairly, trace every lot, and skip the shortcuts that strip away nutrition.",
      "What lands on your shelf is real food. Grown with respect for the soil, the season, and the people who tend it.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "Why this is real food",
    cards: [
      { icon: "leaf-bold", title: "Single-origin", body: "Traceable to one farm lot.", points: ["No blending across regions", "Scan the lot code to verify"] },
      { icon: "test-tube-bold", title: "Lab-tested", body: "Checked before it ships.", points: ["Purity & adulteration screen", "Independent lab on every lot"] },
      { icon: "hand-heart-bold", title: "Farmer-fair", body: "Paid above market, on time.", points: ["Named partner farms", "Long-term relationships"] },
    ],
  },
  uses: {
    title: "How to use it",
    intro: "A few everyday ways our customers reach for this.",
    tips: [
      { key: "Everyday cooking: ", rest: "a dependable staple for the meals you make most." },
      { key: "Store cool & dry: ", rest: "keep it away from direct sunlight to hold freshness." },
      { key: "Open and smell: ", rest: "real food has aroma; that's how you know it's alive." },
    ],
  },
  faq: [
    { q: "Is this product traceable to a farm?", a: "Yes. Every lot carries a code you can scan to see the partner farm, the harvest date, and the lab report for that exact batch." },
    { q: "How is it tested?", a: "Each lot is screened by an independent lab for purity and adulteration before we let it ship. Nothing leaves without a pass." },
    { q: "When do you ship?", a: "We dispatch Tuesdays and Fridays so stock stays fresh. Delivery is free on orders over ₹599." },
    { q: "What is your return policy?", a: "We don't accept cancellations once an order is placed, but if anything arrives damaged or incorrect we'll replace it. Just send a photo within 48 hours." },
  ],
  knowYour: {
    title: "Why it's different",
    intro: "How Nutri Greenz compares to ordinary supermarket staples.",
    rows: ["Sourcing", "Processing", "Testing", "Traceability"],
    types: [
      { name: "Nutri Greenz", icon: "leaf", values: ["Single named farm", "Minimal, slow", "Every lot, independent lab", "Scan-to-source lot code"] },
      { name: "Ordinary", icon: "grain", values: ["Blended, anonymous", "Industrial, fast", "Spot checks at best", "None"] },
    ],
  },
  impact: impact("Sourced direct, traced end-to-end, and paid for fairly, so the people who grow your food thrive too."),
};

/* ──────────────────────────────── per-category ───────────────────────────── */

/** Existing real product-photo directories, mapped into the image slots below. */
const OILS_IMG = "/images/products/oils";
const GHEE_IMG = "/images/products/ghee";
const HONEY_IMG = "/images/products/honey";

const OILS: PdpCategoryContent = {
  produceIcon: "oil",
  credentials: ["Cold-pressed", "Single-origin", "No refining", "Glass-bottled"],
  checks: 70,
  story: {
    eyebrow: "From seed to cold-press",
    title: "From seed to cold-press",
    body: [
      "We buy the season's best seed from a single farm lot, then press it slow and cold. Below 40°C. On a wooden ghani. No heat, no hexane, no bleaching, no deodorising.",
      "What's left is an oil that still tastes of the seed it came from, bottled in UV-protected glass so the aroma reaches your kitchen exactly as it left the press.",
    ],
    image: { src: `${OILS_IMG}/oils-lifestyle.webp`, alt: "Cold-pressed oil poured in an Indian kitchen" },
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with oils",
    cards: [
      { icon: "temperature-bold", title: "Cold-pressed below 40°C", body: "Heat destroys aroma and antioxidants. We never let it.", points: ["Natural vitamin E retained", "Full seed flavour preserved"], image: { src: `${OILS_IMG}/groundnut.webp`, alt: "Cold-pressed groundnut oil in a glass bottle" } },
      { icon: "filter-bold", title: "Single-pass, no refining", body: "One farm lot, one press: no blending, no solvents.", points: ["No hexane extraction", "No bleaching or deodorising"], image: { src: `${OILS_IMG}/sesame.webp`, alt: "Cold-pressed sesame oil in a glass bottle" } },
      { icon: "bottle-bold", title: "Glass-bottled fresh", body: "UV-protected glass, never plastic.", points: ["No leaching off the bottle", "Pressed-to-order freshness"], image: { src: `${OILS_IMG}/coconut.webp`, alt: "Cold-pressed coconut oil in a glass bottle" } },
    ],
  },
  uses: {
    title: "How to cook with cold-pressed oil",
    intro: "Cold-pressed oils shine when you let their flavour through.",
    tips: [
      { key: "Tempering & tadka: ", rest: "the aroma blooms the moment it hits hot ghee or oil." },
      { key: "Finishing drizzle: ", rest: "spoon raw over dal, salads or steamed veg for a nutty top note." },
      { key: "Everyday sautéing: ", rest: "a healthy fat for stir-fries and shallow frying." },
      { key: "Oil pulling & massage: ", rest: "coconut and sesame double up beautifully for skin and hair." },
    ],
    image: { src: `${OILS_IMG}/groundnut-side.webp`, alt: "Cold-pressed oil bottle · pack and label detail" },
  },
  faq: [
    { q: "What does 'cold-pressed' actually mean?", a: "The seed is crushed mechanically at low temperature (below 40°C) without chemical solvents. That keeps the natural antioxidants, aroma and vitamin E that high-heat refining strips out." },
    { q: "Why is the oil cloudy or sedimented?", a: "A little natural sediment is normal and a good sign. It means the oil is unrefined and unfiltered beyond a light strain. Give the bottle a gentle swirl before use." },
    { q: "What is the smoke point, can I deep-fry?", a: "Yes for most everyday Indian cooking and shallow frying. For repeated high-heat deep-frying, groundnut and sesame hold up best." },
    { q: "How should I store it?", a: "Keep the glass bottle away from direct sunlight and heat. No refrigeration needed. Use within the best-before window for peak flavour." },
    { q: "Is it pure single-origin?", a: "Every bottle comes from one farm lot. Never blended across regions. Scan the lot code to see the exact farm and press date." },
  ],
  knowYour: {
    title: "Know your oil",
    intro: "Each cold-pressed oil has its own character. Here's how to pick.",
    rows: ["Flavour", "Smoke point", "Best for", "Benefit"],
    types: [
      { name: "Groundnut", icon: "groundnut", values: ["Nutty, full-bodied", "High", "Deep-frying, curries", "Heart-friendly MUFA"] },
      { name: "Sesame", icon: "sesame", values: ["Toasty, bold", "High", "Tempering, Asian dishes", "Rich in sesamol antioxidants"] },
      { name: "Coconut", icon: "coconut", values: ["Sweet, aromatic", "Medium", "South-Indian, baking", "MCTs for quick energy"] },
      { name: "Mustard", icon: "mustard", values: ["Pungent, sharp", "High", "Pickles, Bengali cooking", "Natural antibacterial"] },
    ],
  },
  impact: impact("Every bottle is pressed from a single farm's seed and traced back to the field it grew in."),
};

const GHEE: PdpCategoryContent = {
  produceIcon: "ghee",
  credentials: ["Bilona-churned", "A2-verified milk", "Lab-tested", "70+ checks"],
  checks: 70,
  story: {
    eyebrow: "Where happy cows roam",
    title: "Where happy cows roam",
    body: [
      "Our ghee begins with indigenous A2 cows. Gir, Sahiwal, Desi. Grazing open pasture, never confined or pushed with synthetic feed. The milk is cultured into curd, hand-churned to butter the traditional Bilona way, then slow-simmered to golden ghee the same day it's collected.",
      "It's a slower, costlier method. But it's the only way to get that grainy texture and nutty aroma that tells you it's the real thing.",
    ],
    image: { src: `${GHEE_IMG}/ghee-farm.webp`, alt: "Indigenous A2 cows grazing open farm pasture" },
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with ghee",
    cards: [
      { icon: "test-tube-bold", title: "A2-protein verified", body: "From indigenous breeds that give A2 milk only.", points: ["Gir, Sahiwal & Desi cows", "Breed verified at source"], image: { src: `${GHEE_IMG}/a2-gir-cow-ghee.webp`, alt: "A2 Gir cow Bilona ghee jar" } },
      { icon: "refresh-bold", title: "Bilona hand-churned", body: "Curd churned to butter, then slow-simmered, not cream-boiled.", points: ["Grainy, granular texture", "Nutty caramel aroma"], image: { src: `${GHEE_IMG}/vedic-bilona-ghee.webp`, alt: "Vedic Bilona hand-churned ghee jar" } },
      { icon: "leaf-bold", title: "Farm to spoon", body: "Made the day milk is collected. Nothing stored, nothing rushed.", points: ["Grass-fed, no synthetic feed", "Single-source, traceable lot"], image: { src: `${GHEE_IMG}/ghee-jar-bowl.webp`, alt: "A2 Bilona ghee jar with a bowl, ready to serve" } },
    ],
  },
  uses: {
    title: "How to use A2 ghee",
    intro: "A high smoke point and rich aroma make ghee endlessly useful.",
    tips: [
      { key: "High-heat cooking: ", rest: "its smoke point beats most oils, ideal for tadka and deep-frying." },
      { key: "A spoon over rice or roti: ", rest: "the simplest way to taste true Bilona ghee." },
      { key: "Baking & sweets: ", rest: "swap butter for ghee in halwa, ladoo and shortbread." },
      { key: "A teaspoon in warm milk: ", rest: "a traditional bedtime ritual in many Indian homes." },
    ],
    image: { src: `${GHEE_IMG}/ghee-lifestyle.webp`, alt: "Golden A2 Bilona ghee poured in an Indian kitchen" },
  },
  faq: [
    { q: "What is A2 ghee and why does it matter?", a: "A2 ghee comes from indigenous cow breeds (like Gir and Sahiwal) whose milk carries only the A2 beta-casein protein, which many people find gentler to digest than ordinary A1 milk." },
    { q: "What is the Bilona method?", a: "Milk is set into curd, the curd is hand-churned to extract butter, and only that butter is simmered into ghee. It's slower than the modern cream-boiling shortcut and gives a grainier, more aromatic ghee." },
    { q: "Why has my ghee become grainy or solid?", a: "Granular texture and natural solidifying in cooler weather are signs of pure, traditionally-made ghee. Not a defect. It melts clear and golden the moment it's warmed." },
    { q: "Does ghee need refrigeration?", a: "No. Store it in a cool, dry place with a clean dry spoon. Good ghee keeps for up to 12 months at room temperature." },
    { q: "Is your milk really grass-fed?", a: "Yes. Our partner cows graze open pasture with no synthetic feed or hormones. Each lot is traceable to the herd it came from." },
  ],
  knowYour: {
    title: "Know your ghee",
    intro: "Not all ghee is the same. Here's how our types compare.",
    rows: ["Flavour", "Texture", "Best for", "Benefit"],
    types: [
      { name: "A2 Desi cow", icon: "milk", values: ["Mild, nutty", "Soft, grainy", "Everyday cooking", "Gentle A2 protein"] },
      { name: "A2 Gir cow", icon: "ghee", values: ["Rich, caramel", "Granular", "Festive & gifting", "Premium Bilona aroma"] },
      { name: "Cultured buffalo", icon: "milk", values: ["Deep, full", "Dense, white", "Sweets & frying", "Higher fat, high smoke point"] },
    ],
  },
  impact: impact("Every jar supports indigenous A2 herds and the families who keep these slow, traditional methods alive."),
};

const HONEY: PdpCategoryContent = {
  produceIcon: "honey",
  credentials: ["Raw & unheated", "Single-forest source", "Lab-tested purity", "No added sugar"],
  checks: 70,
  story: {
    eyebrow: "Straight from the hive",
    title: "Straight from the hive",
    body: [
      "Our honey is gathered by traditional beekeepers from a single forest harvest. Never smoked out, never the queen sacrificed. It's strained, never heated or ultra-filtered, so the enzymes, pollen and aroma the bees built stay exactly where they belong: in the jar.",
      "Because it's truly raw, it naturally crystallises in cooler months. That's not a flaw. It's the surest sign no one boiled the life out of it.",
    ],
    image: { src: `${HONEY_IMG}/honey-jar-dipper.webp`, alt: "Raw honey jar with a wooden dipper and honeycomb" },
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with honey",
    cards: [
      { icon: "fire-bold", title: "Raw & unheated", body: "Never pasteurised. Enzymes and pollen left intact.", points: ["Strained, not ultra-filtered", "Living, active honey"], image: { src: `${HONEY_IMG}/honey-hero.webp`, alt: "Raw unheated honey jar" } },
      { icon: "leaf-bold", title: "Single-forest source", body: "Traced to one forest harvest, not bulk-blended.", points: ["Multifloral, acacia & forest", "Distinct seasonal character"], image: { src: `${HONEY_IMG}/wild-forest-honey.webp`, alt: "Wild forest single-origin raw honey jar" } },
      { icon: "test-tube-bold", title: "Purity lab-tested", body: "Screened for added sugar and syrup adulteration.", points: ["Zero added sugar or jaggery", "C3/C4 purity verified"], image: { src: `${HONEY_IMG}/kashmiri-acacia-honey.webp`, alt: "Lab-tested pure Kashmiri acacia honey jar" } },
    ],
  },
  uses: {
    title: "How to enjoy raw honey",
    intro: "Raw honey is best appreciated unheated, so its enzymes stay alive.",
    tips: [
      { key: "Stir into warm (not hot) water: ", rest: "with lemon for a gentle morning ritual." },
      { key: "Drizzle over breakfast: ", rest: "yoghurt, oats or fruit love a raw spoonful." },
      { key: "A natural sweetener: ", rest: "swap into dressings and marinades off the heat." },
      { key: "Soothe a sore throat: ", rest: "a classic teaspoon, neat, when the weather turns." },
    ],
    image: { src: `${HONEY_IMG}/multifloral-raw-honey.webp`, alt: "Multifloral raw honey jar for everyday use" },
  },
  faq: [
    { q: "Why has my honey crystallised?", a: "Crystallisation is natural and a hallmark of raw, unprocessed honey. Stand the jar in warm water to liquefy it gently: never microwave, as that destroys the enzymes." },
    { q: "Is it really 100% pure?", a: "Yes. Every lot is lab-tested for C3/C4 sugar adulteration and added syrup. We add nothing: no sugar, no jaggery, no glucose." },
    { q: "Is raw honey safe for everyone?", a: "It's wonderful for most people, but raw honey should not be given to infants under 12 months. Otherwise, enjoy freely." },
    { q: "Why does the taste vary between jars?", a: "Because it's single-forest and seasonal. Multifloral, acacia and forest honeys each carry the flavour of the blossoms the bees foraged. Variation means it's genuine." },
    { q: "How should I store it?", a: "Keep it sealed at room temperature, away from direct sunlight. Raw honey never truly spoils." },
  ],
  knowYour: {
    title: "Know your honey",
    intro: "Each honey carries the signature of its blossoms. Here's the difference.",
    rows: ["Flavour", "Colour", "Best for", "Benefit"],
    types: [
      { name: "Multifloral", icon: "honey", values: ["Balanced, floral", "Amber", "Everyday use", "Broad pollen profile"] },
      { name: "Acacia", icon: "leaf", values: ["Delicate, light", "Pale gold", "Tea & desserts", "Slow to crystallise"] },
      { name: "Wild forest", icon: "seedling", values: ["Bold, complex", "Deep amber", "Immunity rituals", "Rich antioxidants"] },
    ],
  },
  impact: impact("Every jar funds traditional beekeepers who protect forests instead of clearing them."),
};

const MILLETS: PdpCategoryContent = {
  produceIcon: "grain",
  credentials: ["Rain-fed", "Naturally gluten-free", "Unpolished", "Low GI"],
  checks: 60,
  story: {
    eyebrow: "Grains as old as India",
    title: "Grains as old as India",
    body: [
      "Millets fed this land long before rice and wheat took over. We source them from dryland smallholder farms that grow them rain-fed and intercropped. The way they've always thrived. Then clean and pack them with minimal processing, never polishing away the fibre.",
      "Wholesome, gluten-free and gentle on blood sugar, they're an ancient grain made for modern kitchens.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with millets",
    cards: [
      { icon: "leaf-bold", title: "Rain-fed & native", body: "Grown the traditional dryland way, no flooding.", points: ["Intercropped smallholdings", "Climate-resilient farming"] },
      { icon: "test-tube-bold", title: "Unpolished, whole", body: "Cleaned and stone-de-husked, never polished.", points: ["Fibre & minerals intact", "Low glycaemic index"] },
      { icon: "hand-heart-bold", title: "Dryland farmer-fair", body: "Direct from smallholders who keep these grains alive.", points: ["Named partner farms", "Above-market pricing"] },
    ],
  },
  uses: {
    title: "How to cook with millets",
    intro: "Millets are versatile. Treat them like rice or flour.",
    tips: [
      { key: "Cook like rice: ", rest: "1 cup millet to 2.5 cups water for fluffy grains." },
      { key: "Soak before cooking: ", rest: "30 minutes improves texture and digestibility." },
      { key: "Swap into idli & dosa: ", rest: "millet batters make lighter, protein-rich classics." },
      { key: "Millet flour rotis: ", rest: "ragi and bajra make warming, mineral-rich flatbreads." },
    ],
  },
  faq: [
    { q: "Are millets gluten-free?", a: "Yes, all true millets are naturally gluten-free, making them a great choice for gluten-sensitive diets. Just check our flour blends if you need strictly single-grain." },
    { q: "Why should I soak millets?", a: "Soaking for 30 minutes to a few hours softens the grain, shortens cooking time, and helps your body absorb the minerals more easily." },
    { q: "Are these polished?", a: "No. We de-husk and clean but never polish, so the fibre, B-vitamins and minerals stay in the grain where they belong." },
    { q: "Do millets help with blood sugar?", a: "Millets have a low glycaemic index, meaning they release energy slowly. Many people choose them as a gentler alternative to white rice." },
    { q: "How do I store them?", a: "Keep in an airtight container in a cool, dry place. Whole millets keep for months; millet flour is best used fresh." },
  ],
  knowYour: {
    title: "Know your millet",
    intro: "Different millets suit different dishes. Here's a quick guide.",
    rows: ["Texture", "Taste", "Best for", "Benefit"],
    types: [
      { name: "Foxtail", icon: "grain", values: ["Fluffy", "Mild", "Pulao, upma", "High in iron"] },
      { name: "Finger (Ragi)", icon: "flour", values: ["Dense", "Earthy", "Rotis, porridge", "Calcium-rich"] },
      { name: "Pearl (Bajra)", icon: "seedling", values: ["Hearty", "Nutty", "Winter rotis", "Warming, high fibre"] },
      { name: "Little", icon: "leaf", values: ["Light", "Delicate", "Rice swap", "Easy to digest"] },
    ],
  },
  impact: impact("Choosing millets supports rain-fed smallholders and a more climate-resilient way of farming."),
};

const SPICES: PdpCategoryContent = {
  produceIcon: "spice",
  credentials: ["Single-origin", "Stone-ground", "No fillers or colour", "Lab-tested"],
  checks: 65,
  story: {
    eyebrow: "Ground for aroma, not shelf-life",
    title: "Ground for aroma, not shelf-life",
    body: [
      "We buy whole spices from single-origin growers. Lakadong turmeric from Meghalaya, chillies sun-dried on the farm, and stone-grind them in small batches so the volatile oils that carry aroma survive. No fillers, no added colour, no anti-caking chemicals.",
      "The result is colour and fragrance you can smell the moment you open the pack, the way a spice should announce itself.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with spices",
    cards: [
      { icon: "leaf-bold", title: "Single-origin whole spice", body: "Sourced as whole spice from one named region.", points: ["High-curcumin Lakadong turmeric", "Farm sun-dried chillies"] },
      { icon: "sledgehammer-bold", title: "Stone-ground in small batches", body: "Low-heat grinding keeps volatile aroma oils alive.", points: ["Vivid natural colour", "Full fragrance retained"] },
      { icon: "test-tube-bold", title: "Nothing added", body: "No fillers, no synthetic colour, no anti-caking agents.", points: ["Adulteration lab-tested", "Pure, undiluted spice"] },
    ],
  },
  uses: {
    title: "How to use whole-ground spices",
    intro: "Fresh-ground spices are potent. A little goes a long way.",
    tips: [
      { key: "Bloom in hot oil: ", rest: "30 seconds of tempering unlocks the deepest aroma." },
      { key: "Add turmeric early: ", rest: "let it cook out its raw edge for a rounder flavour." },
      { key: "Finish with garam masala: ", rest: "sprinkle at the end so its top notes survive." },
      { key: "Store airtight & dark: ", rest: "ground spices fade in light; keep the pack sealed." },
    ],
  },
  faq: [
    { q: "Why is the colour so vivid?", a: "Because there's nothing diluting it. Our turmeric and chilli colour comes entirely from the spice. We never add synthetic dyes or colourants." },
    { q: "What makes Lakadong turmeric special?", a: "Lakadong turmeric from Meghalaya carries one of the highest natural curcumin levels in the world, giving it a deeper colour and stronger profile than ordinary turmeric." },
    { q: "Are these spices pure?", a: "Yes. Every batch is lab-tested for common adulterants like starch, chalk and artificial colour. What's on the label is all that's in the pack." },
    { q: "How long do ground spices stay fresh?", a: "Ground spices are most aromatic within 6–9 months. Keep them airtight, away from heat and light, and buy in sizes you'll finish." },
    { q: "Do you add anti-caking agents?", a: "Never. A little natural clumping in humid weather is normal for additive-free spice. Just break it up with a dry spoon." },
  ],
  knowYour: {
    title: "Know your spice",
    intro: "From earthy to fiery. How our core spices compare.",
    rows: ["Profile", "Heat", "Best for", "Benefit"],
    types: [
      { name: "Lakadong turmeric", icon: "spice", values: ["Earthy, warm", "None", "Curries, lattes", "High curcumin"] },
      { name: "Red chilli", icon: "spice", values: ["Smoky, sharp", "High", "Heat & colour", "Natural capsaicin"] },
      { name: "Coriander", icon: "seedling", values: ["Citrusy, mild", "None", "Base masalas", "Cooling, aromatic"] },
      { name: "Garam masala", icon: "grain", values: ["Complex, warm", "Medium", "Finishing dishes", "Layered blend"] },
    ],
  },
  impact: impact("Buying single-origin spice keeps growers, and heirloom varieties like Lakadong turmeric, thriving."),
};

const SUPERFOODS: PdpCategoryContent = {
  produceIcon: "seedling",
  credentials: ["Sun-dried", "Single-origin", "No additives", "Lab-tested"],
  checks: 60,
  story: {
    eyebrow: "Small spoon, big nutrition",
    title: "Small spoon, big nutrition",
    body: [
      "Our superfoods. Moringa, ashwagandha, turmeric blends. Are grown on partner farms, harvested at peak potency, then gently sun-dried and milled at low temperature so the nutrients survive the journey to powder. No fillers, no flow agents, nothing diluting the dose.",
      "A spoonful is meant to do real work, so we treat every step as if the goodness depends on it, because it does.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with superfoods",
    cards: [
      { icon: "sun-bold", title: "Gently sun-dried", body: "Low-temperature drying protects fragile nutrients.", points: ["Harvested at peak potency", "No high-heat processing"] },
      { icon: "leaf-bold", title: "Single-origin & pure", body: "One farm source, no bulking agents.", points: ["No fillers or flow agents", "Undiluted active dose"] },
      { icon: "test-tube-bold", title: "Potency lab-tested", body: "Each lot screened for purity and contaminants.", points: ["Heavy-metal tested", "Microbial safety checked"] },
    ],
  },
  uses: {
    title: "How to use superfood powders",
    intro: "Easy to fold into what you already eat and drink.",
    tips: [
      { key: "Blend into smoothies: ", rest: "a teaspoon disappears into fruit and yoghurt." },
      { key: "Stir into warm milk: ", rest: "ashwagandha and turmeric make a calming nightcap." },
      { key: "Whisk into lattes: ", rest: "moringa and turmeric brighten a morning cup." },
      { key: "Start small: ", rest: "begin with half a teaspoon and build up gradually." },
    ],
  },
  faq: [
    { q: "How much should I take per day?", a: "Start with about half a teaspoon and build up as you get used to it. A teaspoon a day is typical for most of our powders, but listen to your body." },
    { q: "When is the best time to take it?", a: "Moringa and turmeric suit the morning; ashwagandha is often taken in the evening to wind down. There's no wrong time, consistency matters most." },
    { q: "Are these tested for heavy metals?", a: "Yes. Because superfoods are concentrated, we lab-test every lot for heavy metals and microbial safety before it ships." },
    { q: "Is anything added to bulk it out?", a: "No. There are no fillers, flow agents or maltodextrin: just the pure sun-dried, milled plant." },
    { q: "How should I store the powder?", a: "Keep it airtight, cool and dry, away from sunlight. Use a dry spoon to keep moisture out." },
  ],
  knowYour: {
    title: "Know your superfood",
    intro: "Each does something different. Here's a starting point.",
    rows: ["Best for", "Taste", "When", "Benefit"],
    types: [
      { name: "Moringa", icon: "leaf", values: ["Daily greens", "Grassy", "Morning", "Iron & antioxidants"] },
      { name: "Ashwagandha", icon: "seedling", values: ["Calm & sleep", "Earthy, bitter", "Evening", "Adaptogenic"] },
      { name: "Turmeric blend", icon: "spice", values: ["Anti-inflammatory", "Warm, spiced", "Anytime", "Curcumin boost"] },
    ],
  },
  impact: impact("Concentrated nutrition, grown by partner farms and tested down to the last microgram."),
};

const PULSES: PdpCategoryContent = {
  produceIcon: "nuts",
  credentials: ["Unpolished", "Single-origin", "No water-polish", "Protein-rich"],
  checks: 55,
  story: {
    eyebrow: "The protein of every Indian thali",
    title: "The protein of every Indian thali",
    body: [
      "Dals are the quiet backbone of Indian cooking, and we treat them with respect. Our pulses come from single-origin farms, cleaned and de-husked without the water-polish or oil-coating that makes supermarket dal look glossy but cook unevenly.",
      "What you get is honest, unpolished dal that cooks creamy and tastes of the pulse itself. The way home cooking is meant to.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with pulses",
    cards: [
      { icon: "leaf-bold", title: "Unpolished & honest", body: "No water-polish, no oil or talc coating.", points: ["Fibre and skin intact", "Cooks creamy and even"] },
      { icon: "test-tube-bold", title: "Cleaned & sorted", body: "Stone and grit removed, graded by hand checks.", points: ["No grit or husk", "Consistent grain size"] },
      { icon: "hand-heart-bold", title: "Single-origin & fair", body: "Direct from named pulse-growing farms.", points: ["Above-market pricing", "Fully traceable lot"] },
    ],
  },
  uses: {
    title: "How to cook perfect dal",
    intro: "Unpolished pulses reward a little patience.",
    tips: [
      { key: "Soak before cooking: ", rest: "30–60 minutes cuts cooking time and aids digestion." },
      { key: "Pressure-cook gently: ", rest: "3–4 whistles gives a creamy, fully-cooked dal." },
      { key: "Temper at the end: ", rest: "a fresh tadka of ghee, cumin and chilli lifts everything." },
      { key: "Sprout the whole ones: ", rest: "moong and chana sprout in a day for salads." },
    ],
  },
  faq: [
    { q: "Why does unpolished dal look duller?", a: "Glossy supermarket dal is often polished with water, oil or talc for looks. Ours skips that. A more matte grain means the natural skin and fibre are still intact." },
    { q: "Do I need to soak pulses?", a: "Soaking whole pulses and chana for 30–60 minutes (or overnight) shortens cooking time and makes them easier to digest. Split dals need less." },
    { q: "How long do they take to cook?", a: "Split dals cook in 3–4 pressure-cooker whistles; whole pulses like rajma and kala chana need a longer soak and cook." },
    { q: "Are they cleaned of stones?", a: "Yes, every lot is cleaned and sorted, but with truly unpolished pulses we still recommend a quick rinse and glance before cooking." },
    { q: "How should I store dal?", a: "Airtight, cool and dry. Add a few dried neem leaves or bay leaves to naturally keep pantry pests away." },
  ],
  knowYour: {
    title: "Know your dal",
    intro: "From quick weeknight dals to hearty soaked pulses.",
    rows: ["Cook style", "Texture", "Best for", "Benefit"],
    types: [
      { name: "Toor (Arhar)", icon: "nuts", values: ["Split, quick", "Creamy", "Everyday dal", "High protein"] },
      { name: "Moong", icon: "seedling", values: ["Split, fast", "Light", "Khichdi, soups", "Easy to digest"] },
      { name: "Kala chana", icon: "grain", values: ["Whole, soaked", "Firm", "Curries, salads", "High fibre & iron"] },
      { name: "Rajma", icon: "nuts", values: ["Whole, soaked", "Hearty", "Rajma chawal", "Protein & folate"] },
    ],
  },
  impact: impact("Every bag of honest, unpolished dal supports single-origin pulse farmers paid fairly for their crop."),
};

const FLOURS: PdpCategoryContent = {
  produceIcon: "flour",
  credentials: ["Stone-ground", "Whole-grain", "Nothing removed", "Milled fresh"],
  checks: 55,
  story: {
    eyebrow: "Stone-ground, the way it should be",
    title: "Stone-ground, the way it should be",
    body: [
      "Modern roller mills run hot and fast, and strip out the bran and germ to make flour that lasts forever but gives little back. We stone-grind whole grain slowly on a traditional chakki, so the flour stays cool and keeps every part of the grain.",
      "It's flour with the wheatgerm still in it. More flavour, more fibre, and rotis that actually smell of grain.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with flours",
    cards: [
      { icon: "sledgehammer-bold", title: "Stone-ground & cool", body: "Slow chakki milling never overheats the grain.", points: ["Nutrients survive the mill", "True wholemeal flour"] },
      { icon: "leaf-bold", title: "Whole grain, nothing removed", body: "Bran and germ stay in, not sifted out.", points: ["More fibre per roti", "Natural wheatgerm oils"] },
      { icon: "calendar-bold", title: "Milled fresh", body: "Ground in small batches close to dispatch.", points: ["Peak aroma and flavour", "Not warehouse-aged"] },
    ],
  },
  uses: {
    title: "How to bake & cook with stone-ground flour",
    intro: "Whole-grain flour behaves a little differently, and better.",
    tips: [
      { key: "Rest your dough: ", rest: "20 minutes lets whole-grain atta hydrate for softer rotis." },
      { key: "Add a little extra water: ", rest: "wholemeal flour drinks more than refined maida." },
      { key: "Blend for breads: ", rest: "mix with a little maida for lighter, taller loaves." },
      { key: "Use it fresh: ", rest: "stone-ground flour is most fragrant within a few weeks." },
    ],
  },
  faq: [
    { q: "What does 'stone-ground' mean for me?", a: "Grain is crushed slowly between stones rather than fast steel rollers, so it doesn't overheat. That keeps the natural oils and nutrients that high-speed milling destroys." },
    { q: "Is this whole wheat or refined?", a: "Our atta is true wholemeal. The bran and germ are milled in, not sifted out, giving you more fibre and a fuller flavour than refined maida." },
    { q: "Why does my dough need more water?", a: "Whole-grain flour absorbs more water than refined flour. Add it gradually and rest the dough so the bran can soften." },
    { q: "How long does stone-ground flour keep?", a: "Because the natural germ oils are intact, it's best used within 4–6 weeks. Store it airtight in a cool, dry place or refrigerate to extend freshness." },
    { q: "Is it good for diabetics?", a: "Whole-grain, high-fibre flours release energy more slowly than refined maida, which many people prefer, but always follow your own dietary guidance." },
  ],
  knowYour: {
    title: "Know your flour",
    intro: "Pick the right grind for what you're making.",
    rows: ["Grain", "Texture", "Best for", "Benefit"],
    types: [
      { name: "Sharbati atta", icon: "flour", values: ["Premium wheat", "Soft", "Daily rotis", "Sweet, nutty flavour"] },
      { name: "Multigrain atta", icon: "grain", values: ["Grain blend", "Hearty", "Wholesome rotis", "Extra fibre & protein"] },
      { name: "Besan", icon: "seedling", values: ["Gram (chana)", "Fine", "Pakoras, batters", "Gluten-free protein"] },
    ],
  },
  impact: impact("Stone-grinding fresh keeps the wheatgerm, and small chakki millers, in the picture."),
};

const FRUITS: PdpCategoryContent = {
  produceIcon: "fruit",
  credentials: ["Tree-ripened", "Naturally grown", "No carbide", "Picked-to-order"],
  checks: 50,
  story: {
    eyebrow: "Ripened on the tree, not in a warehouse",
    title: "Ripened on the tree, not in a warehouse",
    body: [
      "Seasonal fruit is best when it ripens where it grew. We work with named orchards that let fruit mature on the tree, then pick to order so it travels to you at its peak. Never gassed with carbide or artificially ripened to fake the colour.",
      "It means our seasons are short and our fruit is real. When the Alphonso window closes, it closes, and that's exactly how it should be.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with produce",
    cards: [
      { icon: "sun-bold", title: "Tree-ripened", body: "Left to mature on the plant for true flavour.", points: ["Natural sugars develop fully", "No artificial ripening"] },
      { icon: "leaf-bold", title: "No carbide, no wax", body: "Ripened naturally, never chemically gassed.", points: ["No calcium carbide", "No cosmetic wax coating"] },
      { icon: "delivery-bold", title: "Picked to order", body: "Harvested close to dispatch, not cold-stored for weeks.", points: ["Shorter farm-to-door time", "Named partner orchards"] },
    ],
  },
  uses: {
    title: "How to enjoy seasonal produce",
    intro: "Naturally ripened fruit needs a little care and rewards it richly.",
    tips: [
      { key: "Let it rest at room temperature: ", rest: "a day or two finishes the ripening naturally." },
      { key: "Don't refrigerate unripe fruit: ", rest: "cold stalls the sweetness from developing." },
      { key: "Eat in season: ", rest: "fruit tastes best in its own short window, so enjoy it then." },
      { key: "A natural blush, not uniform colour: ", rest: "uneven colour is a sign it wasn't gassed." },
    ],
  },
  faq: [
    { q: "Why isn't the fruit perfectly uniform in colour?", a: "Naturally ripened fruit varies in colour and shape. Flawless, uniform fruit is often a sign of artificial ripening. We'd rather give you real." },
    { q: "Is your fruit artificially ripened?", a: "Never. We don't use calcium carbide or ethylene gassing. Fruit ripens on the tree or naturally at room temperature after it arrives." },
    { q: "My fruit arrived slightly firm, is that normal?", a: "Yes, for many fruits we pick at the right stage to survive transit. Rest it at room temperature for a day or two to ripen to perfection." },
    { q: "Why is availability seasonal?", a: "Because we don't cold-store for months. Each fruit has a natural window. When Alphonsos or Coorg oranges are in season, that's when you'll find them." },
    { q: "What if my produce arrives damaged?", a: "Perishables are delicate. If anything arrives bruised or spoiled, send us a photo within 24 hours and we'll make it right." },
  ],
  knowYour: {
    title: "Know your produce",
    intro: "A taste of what each season brings.",
    rows: ["Season", "Taste", "Best for", "Benefit"],
    types: [
      { name: "Alphonso mango", icon: "fruit", values: ["Summer", "Rich, sweet", "Eating fresh", "Vitamin A & C"] },
      { name: "Nendran banana", icon: "leaf", values: ["Most of year", "Starchy, sweet", "Chips, fresh", "Potassium-rich"] },
      { name: "Coorg orange", icon: "fruit", values: ["Winter", "Tangy-sweet", "Juicing", "Vitamin C boost"] },
    ],
  },
  impact: impact("Buying in season supports orchards that ripen fruit honestly instead of forcing it with chemicals."),
};

const GIFTING: PdpCategoryContent = {
  produceIcon: "gift",
  credentials: ["Curated hampers", "Plastic-free packaging", "Lab-tested staples", "Gift-ready"],
  checks: 70,
  story: {
    eyebrow: "Give real, give traceable",
    title: "Give real, give traceable",
    body: [
      "A Nutri Greenz hamper is a way to gift wellness, not just a box. We hand-pick our most-loved single-origin staples. Ghee, honey, cold-pressed oils, spices, and present them in plastic-free, reusable packaging that's as thoughtful as what's inside.",
      "Every item carries the same lot-traceable, lab-tested promise as the rest of the shop. It's a gift you can stand behind, down to the farm it came from.",
    ],
  },
  way: {
    eyebrow: "The Nutri Greenz way",
    title: "The Nutri Greenz way with gifting",
    cards: [
      { icon: "gift-bold", title: "Curated, not random", body: "Hand-picked best-sellers that work together.", points: ["Crowd-pleasing staples", "Balanced sweet & savoury"] },
      { icon: "leaf-bold", title: "Plastic-free packaging", body: "Reusable, recyclable, beautiful out of the box.", points: ["No single-use plastic", "Gift-ready presentation"] },
      { icon: "shield-check-bold", title: "Same farm promise", body: "Every item is traceable and lab-tested.", points: ["Lot codes on every product", "Quality you can vouch for"] },
    ],
  },
  uses: {
    title: "Perfect for every occasion",
    intro: "A wholesome gift that suits almost any moment.",
    tips: [
      { key: "Festive gifting: ", rest: "Diwali, Pongal and weddings call for something meaningful." },
      { key: "Corporate gifting: ", rest: "thoughtful, healthy hampers your clients actually use." },
      { key: "New-home & housewarming: ", rest: "stock a kitchen with honest staples." },
      { key: "Just because: ", rest: "send wellness to someone you'd like to look after." },
    ],
  },
  faq: [
    { q: "Can I include a personal message?", a: "Yes. Add a gift note at checkout and we'll include a handwritten-style card with your message in the hamper." },
    { q: "Is the packaging gift-ready?", a: "Absolutely. Every hamper arrives in plastic-free, reusable packaging, presentation-ready. No extra wrapping needed." },
    { q: "Can I ship directly to the recipient?", a: "Yes. Enter their address at checkout and we'll dispatch straight to them, with no pricing on the packing slip." },
    { q: "What's inside a hamper?", a: "Each hamper lists its exact contents. A curated mix of our most-loved single-origin staples like ghee, honey, oils and spices." },
    { q: "Are the products inside traceable too?", a: "Yes. Every item carries the same lot code, lab test and farm traceability as anything else in the shop." },
  ],
  knowYour: {
    title: "Choose your hamper",
    intro: "Different hampers for different people and occasions.",
    rows: ["Contains", "Size", "Best for", "Feel"],
    types: [
      { name: "Festive hamper", icon: "gift", values: ["Ghee, honey, oils", "Large", "Diwali & weddings", "Premium, generous"] },
      { name: "Wellness box", icon: "seedling", values: ["Superfoods, honey", "Medium", "Health-conscious", "Thoughtful, modern"] },
      { name: "Diwali sampler", icon: "honey", values: ["Best-sellers", "Compact", "Corporate gifting", "Crowd-pleasing"] },
    ],
  },
  impact: impact("Every hamper shares the harvest, and the farmer's story. With someone you care about."),
};

/* ─────────────────────────────── the registry ────────────────────────────── */

export const PDP_CONTENT: Record<PdpCategoryId, PdpCategoryContent> = {
  oils: OILS,
  ghee: GHEE,
  honey: HONEY,
  millets: MILLETS,
  spices: SPICES,
  superfoods: SUPERFOODS,
  pulses: PULSES,
  flours: FLOURS,
  fruits: FRUITS,
  gifting: GIFTING,
};

/** Resolve the full PDP content for a product, with a guaranteed sensible default. */
export function getPdpContent(product: Pick<ProductCard, "tags">): {
  categoryId: PdpCategoryId;
  content: PdpCategoryContent;
} {
  const categoryId = resolveCategoryId(product);
  const content = PDP_CONTENT[categoryId] ?? DEFAULT_CONTENT;
  return { categoryId, content };
}

export { DEFAULT_CONTENT };
