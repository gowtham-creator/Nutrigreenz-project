"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProductCard } from "@/types/nutrigreenz";

const STORAGE_KEY = "ng.wishlist.v1";

interface WishlistContextValue {
  /** All saved products (most-recently saved first). */
  items: ProductCard[];
  /** Whether a product id is currently saved. */
  has: (id: string) => boolean;
  /** Add the product if absent, remove it if already saved. */
  toggle: (product: ProductCard) => void;
  /** Remove a saved product by id. */
  remove: (id: string) => void;
  /** Empty the wishlist. */
  clear: () => void;
  /** Number of saved products. */
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function isProductCard(entry: unknown): entry is ProductCard {
  if (typeof entry !== "object" || entry === null) return false;
  const p = entry as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.slug === "string" &&
    typeof p.title === "string" &&
    typeof p.image === "string" &&
    typeof p.price === "number"
  );
}

function readStoredItems(): ProductCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProductCard);
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ProductCard[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setItems(readStoredItems());
    setHydrated(true);
  }, []);

  // Persist whenever items change (only after initial hydration).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota / private-mode — fail silently */
    }
  }, [items, hydrated]);

  const has = useCallback(
    (id: string) => items.some((item) => item.id === id),
    [items],
  );

  const toggle = useCallback((product: ProductCard) => {
    setItems((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.filter((item) => item.id !== product.id)
        : [product, ...prev],
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.length;

  const value = useMemo<WishlistContextValue>(
    () => ({ items, has, toggle, remove, clear, count }),
    [items, has, toggle, remove, clear, count],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

/** Access the wishlist: saved items + mutators + derived count. */
export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx)
    throw new Error("useWishlist must be used within a <WishlistProvider>");
  return ctx;
}
