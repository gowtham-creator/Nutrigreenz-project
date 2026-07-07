"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import type { ProductCard } from "@/types/nutrigreenz";

/**
 * The wishlist is scoped to the current identity (like the cart/addresses) so a
 * signed-out visitor and every signed-in account keep their OWN saved products
 * and never see another account's. A new account starts empty.
 *
 * SIGNED-IN: the source of truth is the server table (`public.wishlists` via
 * `/api/account/wishlist`), attached to the CANONICAL customer, so saves persist
 * across devices and a person's Google + phone sign-ins. On first sign-in any
 * locally-saved products (guest + this account's old localStorage) are folded
 * into the DB, then the DB takes over; a per-identity localStorage cache is kept
 * only as an offline fallback so the UI never loses data when the API is down.
 *
 * SIGNED-OUT (guest): saves stay in localStorage exactly as before.
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

/** De-duplicate a product list by id, keeping the first (most-recent) occurrence. */
function dedupeById(list: ProductCard[]): ProductCard[] {
  const seen = new Set<string>();
  const out: ProductCard[] = [];
  for (const p of list) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/* ── server wishlist API (signed-in only; the server scopes to the caller) ─── */

/** GET the signed-in customer's saved products, or null when unavailable. */
async function apiListWishlist(): Promise<ProductCard[] | null> {
  try {
    const res = await fetch("/api/account/wishlist", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: unknown };
    return Array.isArray(data.items) ? data.items.filter(isProductCard) : [];
  } catch {
    return null;
  }
}

/** Bulk-merge local slugs into the DB; returns the unified hydrated list. */
async function apiMergeWishlist(slugs: string[]): Promise<ProductCard[] | null> {
  try {
    const res = await fetch("/api/account/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: unknown };
    return Array.isArray(data.items) ? data.items.filter(isProductCard) : [];
  } catch {
    return null;
  }
}

async function apiAddWishlist(productSlug: string): Promise<void> {
  try {
    await fetch("/api/account/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug }),
    });
  } catch {
    /* best-effort — the local optimistic state already reflects the change */
  }
}

async function apiRemoveWishlist(productSlug: string): Promise<void> {
  try {
    await fetch(`/api/account/wishlist?slug=${encodeURIComponent(productSlug)}`, {
      method: "DELETE",
    });
  } catch {
    /* best-effort */
  }
}

async function apiClearWishlist(): Promise<void> {
  try {
    await fetch("/api/account/wishlist?all=1", { method: "DELETE" });
  } catch {
    /* best-effort */
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { account, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ProductCard[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Guards a one-time localStorage→DB fold-in per identity.
  const importedFor = useRef<Set<string>>(new Set());
  // Mirror of `items` for the mutators (so their fetch decisions never go stale).
  const itemsRef = useRef<ProductCard[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const signedIn = Boolean(account);
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

    let cancelled = false;

    // Guest → localStorage only (unchanged behaviour).
    if (!signedIn) {
      setItems(readStoredItems(GUEST_KEY));
      setLoadedKey(storageKey);
      return () => {
        cancelled = true;
      };
    }

    // Signed-in → the DB is the source of truth, with a one-time local fold-in.
    (async () => {
      const localItems = dedupeById([
        ...readStoredItems(storageKey),
        ...readStoredItems(GUEST_KEY),
      ]);

      const server = await apiListWishlist();
      if (cancelled) return;

      // API unavailable (Supabase unconfigured / offline) → fall back to the
      // local cache so the UI keeps working; never lose saves.
      if (server === null) {
        setItems(localItems);
        setLoadedKey(storageKey);
        return;
      }

      let merged = server;
      if (!importedFor.current.has(storageKey)) {
        importedFor.current.add(storageKey);
        const serverSlugs = new Set(server.map((p) => p.slug));
        const toPush = localItems
          .filter((p) => !serverSlugs.has(p.slug))
          .map((p) => p.slug);
        if (toPush.length > 0) {
          const unified = await apiMergeWishlist(toPush);
          if (!cancelled && unified) merged = unified;
        }
        // Guest saves are now server-owned; clear the guest bucket.
        writeStored(GUEST_KEY, []);
      }

      if (!cancelled) {
        setItems(merged);
        setLoadedKey(storageKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, storageKey, loadedKey, signedIn]);

  // Persist to localStorage — the guest store, or the signed-in offline cache.
  useEffect(() => {
    if (loadedKey === null || loadedKey !== storageKey) return;
    writeStored(storageKey, items);
  }, [items, loadedKey, storageKey]);

  const has = useCallback(
    (id: string) => items.some((item) => item.id === id),
    [items],
  );

  const toggle = useCallback(
    (product: ProductCard) => {
      const exists = itemsRef.current.some((item) => item.id === product.id);
      setItems((prev) =>
        exists
          ? prev.filter((item) => item.id !== product.id)
          : [product, ...prev],
      );
      if (signedIn) {
        if (exists) void apiRemoveWishlist(product.slug);
        else void apiAddWishlist(product.slug);
      }
    },
    [signedIn],
  );

  const remove = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((item) => item.id === id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (signedIn && target) void apiRemoveWishlist(target.slug);
    },
    [signedIn],
  );

  const clear = useCallback(() => {
    setItems([]);
    if (signedIn) void apiClearWishlist();
  }, [signedIn]);

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
