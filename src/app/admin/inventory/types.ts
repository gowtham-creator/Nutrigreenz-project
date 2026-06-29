/** Shared client-side types for the Inventory Portal (mirror catalog.ts shapes). */

export type ProductStatus = "active" | "draft" | "archived";

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort: number;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  slug: string;
  description: string | null;
  pricePaise: number;
  imageUrl: string | null;
  sku: string | null;
  status: ProductStatus;
  stock: number;
  reserved: number;
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  label: string;
  pack: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  pricePaise: number;
  sku: string | null;
  stock: number;
  reserved: number;
  isActive: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** Packaging options offered in the variant editor. */
export const PACK_OPTIONS: readonly string[] = ["glass", "plastic", "tin", "bag"];

export interface ImportPreviewRow {
  line: number;
  name: string;
  sku?: string;
  category?: string;
  pricePaise?: number;
  stock?: number;
  status?: string;
  valid: boolean;
  note?: string;
}

export interface ImportPreview {
  total: number;
  validCount: number;
  invalidCount: number;
  rows: ImportPreviewRow[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export const STATUS_OPTIONS: readonly ProductStatus[] = ["active", "draft", "archived"];

export const STATUS_TONE: Record<ProductStatus, "success" | "warn" | "neutral"> = {
  active: "success",
  draft: "warn",
  archived: "neutral",
};

/** Format integer paise to a "₹89.00" rupee string. */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
