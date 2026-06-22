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
import { useAuth } from "@/lib/auth";
import type { ProductCard } from "@/types/nutrigreenz";

/**
 * The wishlist is scoped to the current identity (like the cart/addresses) so a
 * signed-out visitor and every signed-in account keep their OWN saved products
 * and never see another account's. A new account starts empty.
 */
const LEGACY_KEY = "ng.wishlist.v1"; // pre-identity global store — abandoned
const GUEST_KEY = "ng.wishlist.v1::guest";
const USER_PREFIX = "ng.wishlist.v1::u:";

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

function readStoredItems(key: string): ProductCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProductCard);
  } catch {
    return [];
  }
}

function writeStored(key: string, items: ProductCard[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* quota / private-mode — fail silently */
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { account, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ProductCard[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const storageKey = account
    ? `${USER_PREFIX}${account.email || account.phone || "user"}`
    : GUEST_KEY;

  // Load the right wishlist whenever the identity changes (after auth settles).
  useEffect(() => {
    if (authLoading) return;
    if (loadedKey === storageKey) return;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* ignore */
      }
    }
    let next = readStoredItems(storageKey);
    // On sign-in, fold any guest-saved items in (de-duped), then clear guest.
    if (storageKey.startsWith(USER_PREFIX)) {
      const guest = readStoredItems(GUEST_KEY);
      if (guest.length > 0) {
        const ids = new Set(next.map((p) => p.id));
        next = [...next, ...guest.filter((p) => !ids.has(p.id))];
        writeStored(storageKey, next);
        writeStored(GUEST_KEY, []);
      }
    }
    setItems(next);
    setLoadedKey(storageKey);
  }, [authLoading, storageKey, loadedKey]);

  // Persist whenever items change — only once they belong to the active identity.
  useEffect(() => {
    if (loadedKey === null || loadedKey !== storageKey) return;
    writeStored(storageKey, items);
  }, [items, loadedKey, storageKey]);

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
