import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";

export type SortKey =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "newest";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price · low to high" },
  { key: "price-desc", label: "Price · high to low" },
  { key: "rating", label: "Highest rated" },
  { key: "newest", label: "Newest" },
];

/** Maps a category slug to the product `tags` that belong to it. */
export const SLUG_TO_TAGS: Record<string, string[]> = {
  oils: ["oil"],
  ghee: ["ghee"],
  honey: ["honey"],
  millets: ["millet"],
  spices: ["spice"],
  superfoods: ["superfood"],
  pulses: ["pulse"],
  flours: ["flour"],
  fruits: ["fruit"],
  gifting: ["gifting"],
};

/** The canonical tag set for each category slug, for the chip strip + filters. */
export const CATEGORY_TAGS: { tag: string; label: string }[] = [
  { tag: "oil", label: "Oils" },
  { tag: "ghee", label: "Ghee" },
  { tag: "honey", label: "Honey" },
  { tag: "millet", label: "Millets" },
  { tag: "spice", label: "Spices" },
  { tag: "superfood", label: "Superfoods" },
  { tag: "pulse", label: "Pulses" },
  { tag: "flour", label: "Flours" },
  { tag: "fruit", label: "Fruits" },
  { tag: "gifting", label: "Gifting" },
];

export interface ShopFilters {
  /** selected product tags (category facets) */
  tags: string[];
  priceMin: number;
  priceMax: number;
  minRating: number;
  inStockOnly: boolean;
}

export type { ProductCardType };
