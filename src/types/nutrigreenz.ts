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

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  image: string;
  rating: number;
  reviewCount: number;
  price: number;
  mrp?: number;
  unit?: string; // "500g", "1L", etc.
  badge?: string;
  badgeTone?: Tone;
  href?: string;
  tags?: string[];
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
}

/* ──────────────────────────────────────────────────────────────────────────
 * Commerce, location, loyalty & growth types (additive)
 * ────────────────────────────────────────────────────────────────────────── */

/** A delivery time-window the customer can pick at checkout. */
export interface DeliverySlot {
  id: string;
  label: string; // e.g. "Morning · 7–10 AM"
  cutoff: string; // order-by time, e.g. "22:00" (prev day) or ISO
}

/**
 * Storefront commerce configuration. Mocked in the front-end now; a Super Admin
 * edits these values from the admin portal later.
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
  area: string; // e.g. "Indiranagar"
  pincode: string; // e.g. "560038"
  city?: string; // defaults to "Bengaluru"
  lat?: number;
  lng?: number;
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
