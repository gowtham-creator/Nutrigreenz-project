/**
 * Nutrigreenz domain types — shared across customer storefront, admin portal, captain PWA.
 */

export type Tone = "forest" | "leaf" | "sage" | "cream" | "clay" | "terracotta" | "soil" | "ink";

export interface Money {
  amount: number;
  currency?: "INR";
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductBadge {
  label: string;
  tone?: Tone;
}

/**
 * A purchasable size × pack variant of a base product (storefront-facing).
 * Price is in whole rupees; `inStock` already accounts for reserved units.
 */
export interface ProductVariantOption {
  id: string;
  sku: string;
  /** Size label shown to shoppers, e.g. "1L", "500g". */
  label: string;
  /** Packaging: "glass" | "plastic" | "tin" | "bag" | null. */
  pack: string | null;
  /** Numeric size value (1, 500, 10 …), when known. */
  sizeValue: number | null;
  /** Size unit ("L", "ml", "g", "kg"), when known. */
  sizeUnit: string | null;
  /** Variant price in whole rupees (marked down when a promo applies). */
  price: number;
  /** Original (pre-promo) price in rupees — strike-through; set only on sale. */
  mrp?: number;
  /** True when at least one sellable unit remains (stock − reserved > 0). */
  inStock: boolean;
  /** Optional per-variant image URL; null falls back to the product image(s). */
  imageUrl: string | null;
}

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  image: string;
  /**
   * Additional photos for this product, in the order the operator arranged
   * them. Only the PDP uses these; cards show `image` alone. Empty/absent means
   * there are no extra shots — the PDP then shows captioned placeholders rather
   * than borrowing another product's photographs.
   */
  gallery?: string[];
  rating: number;
  reviewCount: number;
  price: number;
  mrp?: number;
  unit?: string; // "500g", "1L", etc.
  badge?: string;
  badgeTone?: Tone;
  href?: string;
  tags?: string[];
  /** When true, `price` is the minimum across active variants → render "from ₹X". */
  priceFrom?: boolean;
  /** Purchasable size × pack variants (empty for legacy/demo single-SKU products). */
  variants?: ProductVariantOption[];
  /**
   * Best applicable occasion/seasonal promotion percent (1..90) when a sale is
   * live for this product; absent when none. When set, `price` is already the
   * discounted price and `mrp` carries the original for a strike-through.
   */
  promoPercent?: number;
  /** Ready-to-render promo chip label, e.g. "15% OFF" (present with `promoPercent`). */
  promoLabel?: string;
}

export interface Category {
  id: string;
  slug: string;
  title: string;
  description?: string;
  icon: string; // svg path or component name
  image?: string;
  productCount?: number;
}

export interface Farm {
  id: string;
  name: string;
  region: string; // e.g., "Anantapur, AP"
  hectares?: number;
  practices: string[]; // "organic", "regenerative", "biodynamic"
  partneredSince?: string; // ISO date
  farmerName?: string;
  story?: string;
  image?: string;
}

export interface LotTraceability {
  lotCode: string; // NG-XXXXX-XXA
  harvestDate: string;
  farm: Farm;
  practices: string[];
  qcReport?: string; // URL
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  quote: string;
  avatar?: string;
  productSlug?: string;
}

export interface JournalArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  category: "recipes" | "stories" | "science" | "guides" | "lab" | "field-notes";
  readMinutes: number;
  publishedAt: string;
  author?: { name: string; avatar?: string };
}

export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  unit?: string;
  qty: number;
  price: number;
  lotCode?: string;
}

export interface Order {
  id: string;
  number: string; // human readable
  placedAt: string;
  status: "placed" | "packed" | "dispatched" | "in_transit" | "delivered" | "cancelled" | "returned";
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentMethod: "razorpay" | "phonepe" | "cod";
  shippingAddress: Address;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "home" | "work" | "other";
  isDefault?: boolean;
  /** Custom label shown when `type` is "other" (e.g. "Mom's place", "Gym"). */
  label?: string;
}

export interface User {
  id: string;
  fullName: string;
  email?: string;
  phone: string;
  avatar?: string;
  joinedAt: string;
  loyaltyTier: "seedling" | "sprout" | "bloom" | "harvest";
  loyaltyPoints: number;
  referralCode: string;
}

export interface CartItem extends OrderItem {
  subscribe?: { frequency: "weekly" | "biweekly" | "monthly"; discount: number };
  /**
   * Stable cart-line key. For a variant line it is `productId::variantId`; for a
   * legacy/simple line it equals `productId`. Two different variants of the same
   * product are therefore distinct cart lines.
   */
  lineId?: string;
  /** Selected variant id (when the line carries a size × pack variant). */
  variantId?: string;
  /** Selected variant SKU, e.g. "OIL-GROUNDNUT-1L-GLASS". */
  variantSku?: string;
  /** Human variant label shown in the bag, e.g. "1L · glass". */
  variantLabel?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Commerce, location, loyalty & growth types (additive)
 * ────────────────────────────────────────────────────────────────────────── */

/** A delivery time-window the customer can pick at checkout. */
export interface DeliverySlot {
  id: string;
  label: string; // e.g. "Morning · 7–10 AM"
  cutoff: string; // order-by time, e.g. "22:00" (prev day) or ISO — may be "" for live config slots
  /** Optional time-window text (e.g. "7–10 AM") supplied by the live config. */
  windowText?: string;
}

/** How delivery is charged below the free-delivery threshold. */
export type ShippingType = "flat" | "slab" | "zero";

/** A progressive shipping slab: subtotal up to `upto` (₹) costs `fee` (₹). */
export interface ShippingSlab {
  upto: number;
  fee: number;
}

/**
 * Storefront commerce configuration. The live values are owned by the Super
 * Admin (Supabase `commerce_rules`) and read by the storefront via the public
 * `/api/commerce-rules` endpoint. Monetary fields here are whole rupees (the
 * server stores paise and the client store converts at the edge).
 */
export interface CommerceRules {
  /** Minimum cart subtotal (₹) required to place an order. */
  minOrderValue: number;
  /** Subtotal (₹) at/above which delivery is free. */
  freeDeliveryThreshold: number;
  /** Flat delivery fee (₹) charged below the free-delivery threshold. */
  shippingFlat: number;
  /** Whether displayed prices already include tax. */
  taxMode: "inclusive" | "exclusive";
  deliverySlots: DeliverySlot[];
  /** How shipping is charged (live config). Defaults to "flat" when absent. */
  shippingType?: ShippingType;
  /** Progressive shipping slabs (₹) — used when `shippingType` is "slab". */
  shippingSlabs?: ShippingSlab[];
  /** Tax rate in basis points (e.g. 500 = 5%). Applied when `taxMode` is "exclusive". */
  taxRateBps?: number;
  /** ISO currency code (e.g. "INR"). */
  currency?: string;
}

/** A discount code redeemable at checkout. */
export interface Coupon {
  code: string; // uppercase, e.g. "FRESH50"
  description: string;
  /** Percentage off (0–100) or a flat ₹ amount, per `type`. */
  type: "percent" | "flat";
  value: number;
  /** Minimum subtotal (₹) required for the coupon to apply. */
  minOrderValue?: number;
  /** Cap (₹) on the discount when `type` is "percent". */
  maxDiscount?: number;
  /** ISO date after which the coupon is invalid. */
  expiresAt?: string;
  /** Restrict to first-time customers only. */
  firstOrderOnly?: boolean;
  active: boolean;
}

/** A serviceable delivery zone derived from a pincode/area. */
export interface LocationZone {
  area: string; // e.g. "Madhapur"
  pincode: string; // e.g. "500081"
  city?: string; // defaults to "Hyderabad"
  lat?: number;
  lng?: number;
}

/**
 * Best-effort delivery hint captured from the storefront "Deliver to" GPS
 * auto-detect and persisted on a signed-in customer who has not yet saved an
 * address. Superseded once the customer saves a real delivery address.
 */
export interface AutoDetectedLocation {
  area: string;
  pincode: string;
  city?: string;
  lat?: number;
  lng?: number;
  /** ISO timestamp of when geolocation captured this hint. */
  detectedAt: string;
}

/** A walk-in / phone customer captured by store staff (offline order source). */
export interface OfflineCustomer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  defaultPincode?: string;
  notes?: string;
  createdAt: string; // ISO
  totalOrders?: number;
}

/** A single accrual or redemption in a customer's loyalty-points ledger. */
export interface LoyaltyLedgerEntry {
  id: string;
  userId: string;
  type: "earned" | "redeemed" | "expired" | "adjusted";
  points: number; // positive for earned/adjusted-up, negative for redeemed/expired
  reason: string; // e.g. "Order NG-10241", "Referral bonus"
  orderId?: string;
  createdAt: string; // ISO
  balanceAfter: number;
}

/** A referral made by an existing customer (referrer → referee). */
export interface Referral {
  id: string;
  referrerUserId: string;
  referralCode: string;
  refereePhone?: string;
  refereeName?: string;
  status: "invited" | "signed_up" | "first_order_placed" | "rewarded" | "expired";
  rewardPoints?: number;
  invitedAt: string; // ISO
  rewardedAt?: string; // ISO
}

/* ── Captain module (field-sales "captain" PWA + admin management) ────────────
 * A captain runs a stall in a residential community and captures walk-up sales
 * on the /captain tool. Money is INTEGER PAISE end-to-end (DB + API layer),
 * converted to rupees only at the UI edge — mirroring the storefront/admin.
 * Captain phones are stored as a normalized 10-digit string (the OTP sign-in
 * key); captured customer mobiles are cross-matched to canonical customers.
 */

/** How a captured stall sale was paid. Stored lowercase in the DB. */
export type CaptainPayMode = "cash" | "upi";

/** A captain — a field agent who runs community stalls (admin-managed). */
export interface Captain {
  id: string;
  name: string;
  /** Normalized 10-digit mobile (unique). The captain signs in by phone-OTP. */
  phone: string;
  area: string | null;
  stall: string | null;
  /** Communities this captain rotates stalls through. */
  communities: string[];
  /** Whole-number commission percent (0..100) applied to settled GMV. */
  commissionPercent: number;
  active: boolean;
  createdBy: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** One line item within a captured stall sale. Price is INTEGER PAISE. */
export interface CaptainCaptureItem {
  sku: string;
  title: string;
  unit: string;
  pricePaise: number;
  qty: number;
  /**
   * Catalogue variant this line was sold from. Optional because historic
   * captures predate it — those were recorded against a hardcoded list whose
   * SKUs matched no real product, so they cannot be back-filled.
   */
  variantId?: string | null;
  productId?: string | null;
}

/** A single walk-up sale captured by a captain at a stall. Money is paise. */
export interface CaptainCapture {
  id: string;
  captainId: string;
  customerName: string;
  /** Normalized 10-digit mobile — cross-matched to a canonical customer. */
  customerMobile: string;
  community: string | null;
  items: CaptainCaptureItem[];
  totalPaise: number;
  payMode: CaptainPayMode;
  notes: string | null;
  /** Set when `customerMobile` matched a canonical customer (`customers.id`). */
  linkedCustomerId: string | null;
  capturedAt: string; // ISO
}

/** A captain's end-of-day cash-up. One row per captain per day. Money is paise. */
export interface CaptainSettlement {
  id: string;
  captainId: string;
  settleDate: string; // YYYY-MM-DD
  expectedGmvPaise: number;
  cashExpectedPaise: number;
  upiExpectedPaise: number;
  cashCountedPaise: number;
  variancePaise: number; // cashCounted - cashExpected (negative ⇒ short)
  commissionPaise: number; // round(gmv * commissionPercent / 100)
  submittedAt: string; // ISO
}

/** The lifecycle of a community pickup a captain collects + hands over. */
export type CaptainPickupStatus = "due" | "collected" | "handed_over";

/** A community pickup a captain must collect and hand over. */
export interface CaptainPickup {
  id: string;
  captainId: string;
  community: string;
  address: string | null;
  status: CaptainPickupStatus;
  dueAt: string | null; // ISO
  updatedAt: string; // ISO
  createdAt: string; // ISO
}

/** Aggregate day figures for a captain. Money is INTEGER PAISE. */
export interface CaptainStats {
  /** Captures recorded today. */
  count: number;
  /** Captures today that carried at least one line item. */
  orders: number;
  gmvPaise: number;
  cashPaise: number;
  upiPaise: number;
}

/** A captain enriched with their day figures (for the admin roster). */
export interface CaptainWithStats extends Captain {
  todayStats: CaptainStats;
}
