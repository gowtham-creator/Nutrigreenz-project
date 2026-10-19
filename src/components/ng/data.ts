/**
 * Sample data for Nutrigreenz storefront — product catalog, categories, journal, testimonials, farms.
 * Used by all routes; real data would come from Postgres via API.
 */

import type {
  Category,
  Farm,
  JournalArticle,
  ProductCard,
  Testimonial,
} from "@/types/nutrigreenz";

/**
 * The categories we actually sell.
 *
 * This list used to carry ten — millets, spices, superfoods, pulses, flours,
 * seasonal produce and gifting hampers alongside the real three — with invented
 * product counts of 22, 18 and 17. None of those categories exist in the
 * catalogue. They were placeholder content from the scaffold that nothing ever
 * removed, and because the sitemap is generated from this array, Google was
 * being told about /shop/spices and /shop/gifting on every crawl. Each one is a
 * soft-404 for a shopper and a thin-content signal for the site.
 *
 * Counts are not repeated here on purpose. The live catalogue owns them, and a
 * number sitting in a constant is a number that goes stale the first time
 * somebody publishes a product.
 *
 * `rice` is deliberately absent. It exists in the database, but its only
 * product is still a draft, and `getStorefrontCatalog` returns only categories
 * with at least one ACTIVE product, so /shop/rice calls notFound(). Listing it
 * anywhere advertises a guaranteed 404. It returns the moment Sona Masoori is
 * published, with no code change: this array is the offline sample, and the
 * live catalogue drives the real navigation.
 */
export const CATEGORIES: Category[] = [
  { id: "oils", slug: "oils", title: "Cold-Pressed Oils", icon: "oil", productCount: 6 },
  { id: "honey", slug: "honey", title: "Honey", icon: "honey", productCount: 4 },
  { id: "ghee", slug: "ghee", title: "Ghee", icon: "ghee", productCount: 4 },
];

export const PRODUCTS: ProductCard[] = [
  // Oils
  { id: "p-001", slug: "cold-pressed-groundnut-oil-1l", title: "Cold-Pressed Groundnut Oil · 1L Glass", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 1284, price: 645, mrp: 720, unit: "1L · Anantapur lot", badge: "Best seller", badgeTone: "forest", tags: ["oil"] },
  { id: "p-002", slug: "wood-pressed-sunflower-oil-1l", title: "Wood-Pressed Sunflower Oil · 1L", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 642, price: 489, mrp: 580, unit: "1L · Telangana lot", badge: "16% OFF", badgeTone: "terracotta", tags: ["oil"] },
  { id: "p-003", slug: "cold-pressed-coconut-oil-500ml", title: "Cold-Pressed Coconut Oil · 500ml", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 2104, price: 425, mrp: 525, unit: "500ml · Kerala lot", badge: "Subscribe & save 8%", badgeTone: "leaf", tags: ["oil"] },
  { id: "p-004", slug: "cold-pressed-sesame-oil-500ml", title: "Cold-Pressed Sesame Oil · 500ml", image: "/images/placeholder.svg", rating: 4.5, reviewCount: 348, price: 365, mrp: 410, unit: "500ml · Tamil Nadu lot", tags: ["oil"] },
  // Ghee
  { id: "p-101", slug: "a2-gir-cow-ghee-500ml", title: "A2 Gir Cow Bilona Ghee · 500ml", image: "/images/placeholder.svg", rating: 4.9, reviewCount: 3120, price: 1480, mrp: 1700, unit: "500ml · 18 cows · Junagadh", badge: "Bilona method", badgeTone: "clay", tags: ["ghee"] },
  { id: "p-102", slug: "a2-desi-cow-ghee-1l", title: "A2 Desi Cow Ghee · 1L Jar", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 1856, price: 2780, mrp: 3100, unit: "1L · Hand-churned", tags: ["ghee"] },
  { id: "p-103", slug: "cultured-buffalo-ghee-250ml", title: "Cultured Buffalo Ghee · 250ml", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 412, price: 540, mrp: 620, unit: "250ml · 48-hour culture", tags: ["ghee"] },
  // Honey
  { id: "p-201", slug: "multifloral-raw-honey-500g", title: "Multifloral Raw Honey · 500g", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 962, price: 540, mrp: 620, unit: "500g · Nilgiri forest", badge: "Lab-tested", badgeTone: "leaf", tags: ["honey"] },
  { id: "p-202", slug: "kashmiri-acacia-honey-350g", title: "Kashmiri Acacia Honey · 350g", image: "/images/placeholder.svg", rating: 4.9, reviewCount: 287, price: 920, unit: "350g · Pulwama valley", tags: ["honey"] },
  // Millets
  { id: "p-301", slug: "foxtail-millet-500g", title: "Foxtail Millet · 500g", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 514, price: 180, unit: "500g · Bellary lot", tags: ["millet"] },
  { id: "p-302", slug: "finger-millet-flour-1kg", title: "Finger Millet (Ragi) Flour · 1kg", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 1086, price: 220, mrp: 250, unit: "1kg · Stone-ground", badge: "Family pack", badgeTone: "sage", tags: ["millet", "flour"] },
  // Superfoods
  { id: "p-401", slug: "moringa-powder-200g", title: "Moringa Leaf Powder · 200g", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 728, price: 380, unit: "200g · Sun-dried", badge: "Superfood", badgeTone: "leaf", tags: ["superfood"] },
  { id: "p-402", slug: "turmeric-latte-blend-150g", title: "Turmeric Latte Blend · 150g", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 1340, price: 420, mrp: 480, unit: "150g · 6-spice blend", tags: ["superfood"] },
  // Gifting
  { id: "p-501", slug: "harvest-hamper-festive", title: "Harvest Hamper · Festive Edition", image: "/images/placeholder.svg", rating: 5.0, reviewCount: 142, price: 2480, mrp: 2860, unit: "10 items · gift box", badge: "Limited", badgeTone: "terracotta", tags: ["gifting"] },
  // Oils (more)
  { id: "p-005", slug: "kachi-ghani-mustard-oil-1l", title: "Kachi Ghani Mustard Oil · 1L", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 731, price: 410, mrp: 460, unit: "1L · Rajasthan lot", tags: ["oil"] },
  { id: "p-006", slug: "cold-pressed-almond-oil-250ml", title: "Cold-Pressed Almond Oil · 250ml", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 214, price: 690, unit: "250ml · Kashmir lot", badge: "New", badgeTone: "leaf", tags: ["oil"] },
  // Ghee (more)
  { id: "p-104", slug: "a2-sahiwal-cow-ghee-500ml", title: "A2 Sahiwal Cow Ghee · 500ml", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 905, price: 1380, mrp: 1550, unit: "500ml · Punjab", tags: ["ghee"] },
  { id: "p-105", slug: "vedic-bilona-ghee-250ml", title: "Vedic Bilona Ghee · 250ml", image: "/images/placeholder.svg", rating: 4.9, reviewCount: 388, price: 820, unit: "250ml · small batch", badge: "Bilona method", badgeTone: "clay", tags: ["ghee"] },
  // Honey (more)
  { id: "p-203", slug: "wild-forest-honey-500g", title: "Wild Forest Honey · 500g", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 642, price: 620, mrp: 700, unit: "500g · Sundarbans", tags: ["honey"] },
  { id: "p-204", slug: "jamun-blossom-honey-350g", title: "Jamun Blossom Honey · 350g", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 196, price: 540, unit: "350g · single-origin", badge: "Lab-tested", badgeTone: "leaf", tags: ["honey"] },
  // Millets (more)
  { id: "p-303", slug: "pearl-millet-bajra-1kg", title: "Pearl Millet (Bajra) · 1kg", image: "/images/placeholder.svg", rating: 4.5, reviewCount: 321, price: 160, unit: "1kg · Rajasthan", tags: ["millet"] },
  { id: "p-304", slug: "little-millet-500g", title: "Little Millet · 500g", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 188, price: 190, unit: "500g · Telangana", tags: ["millet"] },
  // Spices & masalas
  { id: "p-601", slug: "lakadong-turmeric-powder-250g", title: "Lakadong Turmeric Powder · 250g", image: "/images/placeholder.svg", rating: 4.9, reviewCount: 1472, price: 280, mrp: 320, unit: "250g · Meghalaya · 7% curcumin", badge: "High curcumin", badgeTone: "forest", tags: ["spice"] },
  { id: "p-602", slug: "stone-ground-red-chilli-powder-200g", title: "Stone-Ground Red Chilli Powder · 200g", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 537, price: 180, unit: "200g · Guntur", tags: ["spice"] },
  { id: "p-603", slug: "coriander-powder-200g", title: "Coriander Powder · 200g", image: "/images/placeholder.svg", rating: 4.5, reviewCount: 264, price: 120, unit: "200g · Kota", tags: ["spice"] },
  { id: "p-604", slug: "garam-masala-100g", title: "Garam Masala · 100g", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 612, price: 160, mrp: 190, unit: "100g · 13-spice blend", badge: "Small batch", badgeTone: "sage", tags: ["spice"] },
  // Pulses & dals
  { id: "p-701", slug: "toor-dal-arhar-1kg", title: "Toor Dal (Arhar) · 1kg", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 489, price: 190, unit: "1kg · unpolished", tags: ["pulse"] },
  { id: "p-702", slug: "moong-dal-yellow-1kg", title: "Moong Dal (Yellow) · 1kg", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 421, price: 175, unit: "1kg · hand-cleaned", tags: ["pulse"] },
  { id: "p-703", slug: "kala-chana-1kg", title: "Black Chana (Kala Chana) · 1kg", image: "/images/placeholder.svg", rating: 4.5, reviewCount: 233, price: 150, mrp: 170, unit: "1kg · desi cultivar", tags: ["pulse"] },
  { id: "p-704", slug: "rajma-kidney-beans-1kg", title: "Rajma (Kidney Beans) · 1kg", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 356, price: 220, unit: "1kg · Jammu", badge: "Heirloom", badgeTone: "clay", tags: ["pulse"] },
  // Stone-ground flours
  { id: "p-801", slug: "sharbati-atta-5kg", title: "Stone-Ground Sharbati Atta · 5kg", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 1893, price: 320, mrp: 360, unit: "5kg · MP sharbati", badge: "Family pack", badgeTone: "sage", tags: ["flour"] },
  { id: "p-802", slug: "multigrain-atta-1kg", title: "Multigrain Atta · 1kg", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 472, price: 140, unit: "1kg · 7 grains", tags: ["flour"] },
  { id: "p-803", slug: "besan-gram-flour-1kg", title: "Besan (Gram Flour) · 1kg", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 388, price: 160, unit: "1kg · stone-ground", tags: ["flour"] },
  // Seasonal produce
  { id: "p-901", slug: "alphonso-mangoes-dozen", title: "Alphonso Mangoes · 1 Dozen", image: "/images/placeholder.svg", rating: 4.9, reviewCount: 742, price: 899, mrp: 1050, unit: "1 dozen · Ratnagiri", badge: "In season", badgeTone: "terracotta", tags: ["fruit"] },
  { id: "p-902", slug: "nendran-bananas-1kg", title: "Nendran Bananas · 1kg", image: "/images/placeholder.svg", rating: 4.5, reviewCount: 167, price: 90, unit: "1kg · Kerala", tags: ["fruit"] },
  { id: "p-903", slug: "organic-tomatoes-1kg", title: "Organic Tomatoes · 1kg", image: "/images/placeholder.svg", rating: 4.4, reviewCount: 211, price: 75, unit: "1kg · Kolar", tags: ["fruit"] },
  { id: "p-904", slug: "coorg-oranges-1kg", title: "Coorg Oranges · 1kg", image: "/images/placeholder.svg", rating: 4.6, reviewCount: 143, price: 140, unit: "1kg · Coorg", tags: ["fruit"] },
  // Superfoods (more)
  { id: "p-403", slug: "ashwagandha-root-powder-200g", title: "Ashwagandha Root Powder · 200g", image: "/images/placeholder.svg", rating: 4.7, reviewCount: 583, price: 340, unit: "200g · KSM-66", tags: ["superfood"] },
  { id: "p-404", slug: "cacao-date-energy-mix-250g", title: "Raw Cacao + Date Energy Mix · 250g", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 254, price: 460, mrp: 520, unit: "250g · no refined sugar", badge: "New", badgeTone: "leaf", tags: ["superfood"] },
  // Gifting (more)
  { id: "p-502", slug: "wellness-gift-box", title: "Wellness Box · Oils & Ghee", image: "/images/placeholder.svg", rating: 4.9, reviewCount: 96, price: 1850, unit: "5 items · gift box", badge: "Best gift", badgeTone: "forest", tags: ["gifting"] },
  { id: "p-503", slug: "diwali-sampler-hamper", title: "Diwali Sampler Hamper", image: "/images/placeholder.svg", rating: 4.8, reviewCount: 118, price: 1450, mrp: 1600, unit: "8 items · festive", badge: "Limited", badgeTone: "terracotta", tags: ["gifting"] },
];

export const FARMS: Farm[] = [
  {
    id: "f-anantapur",
    name: "Mallika & Subbaiah Farm",
    region: "Anantapur, Andhra Pradesh",
    hectares: 14,
    practices: ["organic", "rainwater harvesting", "intercropping"],
    partneredSince: "2019-04-12",
    farmerName: "K. Subbaiah",
    story: "Three generations of this family have farmed dry land here. In 2021 we helped them move 9 acres off groundnut monoculture and into mixed cropping.",
    image: "/images/farm/dryland-farm.webp",
  },
  {
    id: "f-junagadh",
    name: "Hetal Dairy",
    region: "Junagadh, Gujarat",
    hectares: 6,
    practices: ["A2 dairy", "bilona churning", "biodynamic"],
    partneredSince: "2020-08-22",
    farmerName: "Hetal Pateel",
    story: "The dairy keeps 18 Gir cows. They are milked by hand and get no synthetic feed, and the bilona ghee is made on the same day the milk is collected.",
    image: "/images/farm/gir-farm.webp",
  },
  {
    id: "f-nilgiri",
    name: "Periyar Bee Co-op",
    region: "Nilgiris, Tamil Nadu",
    practices: ["wild honey", "co-operative", "forest-adjacent"],
    partneredSince: "2021-01-15",
    farmerName: "23-member co-op",
    story: "The co-op harvests its honey without smoke and without killing the queen. We test every lot for purity at our Hyderabad lab.",
    image: "/images/farm/bee-coop.webp",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  { id: "t1", name: "Anjali R.", location: "Hyderabad", rating: 5, quote: "The traceability is real. I scanned the lot code on my ghee jar and saw the actual cow it came from. That's wild.", productSlug: "a2-gir-cow-ghee-500ml" },
  { id: "t2", name: "Rahul M.", location: "Mumbai", rating: 5, quote: "Switched our entire pantry. Six months in, my mom can taste the difference in chapati made from their ragi flour.", productSlug: "finger-millet-flour-1kg" },
  { id: "t3", name: "Priya K.", location: "Hyderabad", rating: 5, quote: "I love that the price they charge actually reaches the farmer. The story on the back of every pack is grounding.", productSlug: "cold-pressed-groundnut-oil-1l" },
];

export const JOURNAL: JournalArticle[] = [
  { id: "j1", slug: "why-bilona-matters", title: "Why bilona is the only ghee method we'll ever use", excerpt: "Our ghee takes three days of hand-churning and eleven liters of milk for every liter in the jar. This is the science of why the slow way makes better ghee.", cover: "/images/journal/why-bilona-matters.webp", category: "science", readMinutes: 8, publishedAt: "2026-04-12" },
  { id: "j2", slug: "anantapur-rains", title: "Field notes: the rains came late this year", excerpt: "Unpredictable weather is changing the way our partner farms plan their year. Our agronomist wrote this after a visit to the groundnut belt.", cover: "/images/journal/anantapur-rains.webp", category: "field-notes", readMinutes: 6, publishedAt: "2026-03-28" },
  { id: "j3", slug: "millet-pongal", title: "Subbaiah's mother's foxtail millet pongal", excerpt: "An everyday dish in Anantapur kitchens, written down between harvests. It takes twenty minutes from start to finish.", cover: "/images/journal/millet-pongal.webp", category: "recipes", readMinutes: 5, publishedAt: "2026-03-15" },
  { id: "j4", slug: "what-lab-tests-mean", title: "What our lab tests actually tell you", excerpt: "Heavy metals, aflatoxin and pesticide residue: the three numbers every honest brand should put on its label.", cover: "/images/journal/what-lab-tests-mean.webp", category: "guides", readMinutes: 10, publishedAt: "2026-02-20" },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Commerce, location, loyalty & order sample data (additive)
 * ────────────────────────────────────────────────────────────────────────── */

import type {
  Coupon,
  LoyaltyLedgerEntry,
  Order,
} from "@/types/nutrigreenz";
import { COMMERCE_RULES } from "@/lib/commerce";
import { SERVICEABLE_PINCODES } from "@/lib/location";

// Re-export the canonical commerce config + serviceable pincodes so consumers
// can pull all sample data from one module.
export { COMMERCE_RULES, SERVICEABLE_PINCODES };

export const COUPONS: Coupon[] = [
  {
    code: "FRESH50",
    description: "₹50 off your first order",
    type: "flat",
    value: 50,
    minOrderValue: 300,
    firstOrderOnly: true,
    active: true,
  },
  {
    code: "HARVEST10",
    description: "10% off, up to ₹150",
    type: "percent",
    value: 10,
    minOrderValue: 599,
    maxDiscount: 150,
    expiresAt: "2026-12-31",
    active: true,
  },
  {
    code: "GHEELOVE",
    description: "₹75 off A2 ghee orders over ₹800",
    type: "flat",
    value: 75,
    minOrderValue: 800,
    active: true,
  },
  {
    code: "MONSOON25",
    description: "Expired monsoon promo",
    type: "percent",
    value: 25,
    expiresAt: "2025-09-30",
    active: false,
  },
];

export const LOYALTY_LEDGER: LoyaltyLedgerEntry[] = [
  { id: "ll-1", userId: "u-001", type: "earned", points: 64, reason: "Order NG-10238", orderId: "o-10238", createdAt: "2026-05-02T09:14:00+05:30", balanceAfter: 64 },
  { id: "ll-2", userId: "u-001", type: "earned", points: 120, reason: "Referral bonus, Rahul M.", createdAt: "2026-05-09T18:30:00+05:30", balanceAfter: 184 },
  { id: "ll-3", userId: "u-001", type: "redeemed", points: -100, reason: "Redeemed at checkout, Order NG-10241", orderId: "o-10241", createdAt: "2026-05-20T11:02:00+05:30", balanceAfter: 84 },
  { id: "ll-4", userId: "u-001", type: "earned", points: 45, reason: "Order NG-10241", orderId: "o-10241", createdAt: "2026-05-20T11:02:30+05:30", balanceAfter: 129 },
];

export const SAMPLE_ORDER: Order = {
  id: "o-10241",
  number: "NG-10241",
  placedAt: "2026-05-20T11:02:00+05:30",
  status: "in_transit",
  items: [
    { productId: "p-001", title: "Cold-Pressed Groundnut Oil · 1L Glass", image: "/images/placeholder.svg", unit: "1L · Anantapur lot", qty: 1, price: 645, lotCode: "NG-ANP24-07A" },
    { productId: "p-ghee", title: "A2 Gir Cow Ghee · 500ml", image: "/images/placeholder.svg", unit: "500ml · Junagadh", qty: 1, price: 899, lotCode: "NG-JUN24-03B" },
  ],
  subtotal: 1544,
  shipping: 0,
  discount: 100,
  total: 1444,
  paymentMethod: "razorpay",
  shippingAddress: {
    id: "addr-1",
    fullName: "Anjali Rao",
    phone: "+919812345678",
    line1: "402, My Home Avatar",
    line2: "Hitech City Main Road",
    landmark: "Near Madhapur Metro",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    type: "home",
    isDefault: true,
  },
  trackingNumber: "NG-TRK-10241",
  estimatedDelivery: "2026-05-22T19:00:00+05:30",
};
