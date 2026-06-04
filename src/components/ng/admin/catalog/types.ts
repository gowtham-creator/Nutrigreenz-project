/**
 * Shared admin-catalog types.
 *
 * `AdminProduct` is the editable, table-facing shape used across the Catalog
 * and Inventory admin screens. It is a flattened superset of the storefront
 * `ProductCard` (from `@/types/nutrigreenz`) plus the operational fields the
 * admin desk edits: SKU, category, price/MRP, stock, status, lot code and a
 * short internal description.
 *
 * NOTE (demo persistence): rows live in local React state only. Real
 * create/update + DB sync lands in Milestone 2.
 */

/** Lifecycle status surfaced in the catalog table + status Pill. */
export type ProductStatus = "Published" | "Draft" | "Out of stock" | "Archived";

/** A single editable catalog row. */
export interface AdminProduct {
  /** Stable id; client-generated for new rows (`new-…`). */
  id: string;
  title: string;
  sku: string;
  category: string;
  /** Selling price, ₹. */
  price: number;
  /** Strike-through MRP, ₹ (0 = no MRP shown). */
  mrp: number;
  stock: number;
  status: ProductStatus;
  /** Active lot / batch code, e.g. "ANT-24-051". */
  lot: string;
  /** Short internal description / unit blurb. */
  description: string;
  /** Storefront rating (read-only in admin; preserved for the table). */
  rating: number;
  /** Image src for the row thumbnail. */
  image: string;
  /** Optional storefront badge label. */
  badge?: string;
}

/** The status values selectable in the product form. */
export const STATUS_OPTIONS: ProductStatus[] = ["Published", "Draft", "Out of stock", "Archived"];

/** Category options for the form select — mirrors the storefront taxonomy. */
export const CATEGORY_OPTIONS = [
  "Oils",
  "Ghee",
  "Honey",
  "Millets",
  "Flours",
  "Superfoods",
  "Spices",
  "Pulses",
  "Produce",
  "Gifting",
  "Other",
] as const;

/** Tone mapping for the status Pill, shared by catalog + form preview. */
export const STATUS_TONE: Record<ProductStatus, "success" | "warn" | "danger" | "neutral"> = {
  Published: "success",
  Draft: "warn",
  "Out of stock": "danger",
  Archived: "neutral",
};
