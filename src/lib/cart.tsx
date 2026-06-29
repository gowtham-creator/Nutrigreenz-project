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
import type { CartItem, ProductCard } from "@/types/nutrigreenz";

/** The selected variant a cart line carries (size × pack + its own price). */
export interface CartVariantInput {
  id: string;
  sku?: string;
  /** Display label shown in the bag, e.g. "1L · glass". */
  label: string;
  /** Variant price in whole rupees (overrides the base product price). */
  price: number;
}

/** Stable cart-line key — variant lines are distinct from one another. */
function lineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

/** Resolve a stored line's key, tolerating legacy items saved without `lineId`. */
function lineIdOf(item: CartItem): string {
  return item.lineId ?? lineKey(item.productId, item.variantId);
}

/**
 * The cart is scoped to the current identity so it behaves like a real store:
 *  - a signed-out visitor uses the GUEST bucket;
 *  - each signed-in account has its OWN saved cart (`…::u:<id>`);
 *  - signing out empties the visible cart (back to the guest bucket);
 *  - signing in restores that account's last-saved cart, and any items added
 *    while browsing as a guest are merged in (so nothing is lost).
 */
const LEGACY_KEY = "ng.cart.v1"; // pre-identity single cart — migrated once into guest
const GUEST_KEY = "ng.cart.v1::guest";
const USER_PREFIX = "ng.cart.v1::u:";

interface CartContextValue {
  items: CartItem[];
  /**
   * Add a product to the cart (or increment the matching line). When a `variant`
   * is supplied the line carries it (id / sku / "1L · glass" label + its price),
   * and different variants of the same product become separate lines.
   */
  addItem: (product: ProductCard, qty?: number, variant?: CartVariantInput) => void;
  /** Remove a line item entirely by its line id. */
  removeItem: (lineId: string) => void;
  /** Set the quantity of a line item by its line id; quantities <= 0 remove it. */
  updateQty: (lineId: string, qty: number) => void;
  /** Empty the cart. */
  clear: () => void;
  /** Total number of units across all line items. */
  count: number;
  /** Sum of price × qty across all line items (₹). */
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function toCartItem(product: ProductCard, qty: number, variant?: CartVariantInput): CartItem {
  if (variant) {
    return {
      productId: product.id,
      lineId: lineKey(product.id, variant.id),
      title: product.title,
      image: product.image,
      // Surface the variant in the bag, e.g. "1L · glass".
      unit: variant.label,
      price: variant.price,
      qty,
      variantId: variant.id,
      variantSku: variant.sku,
      variantLabel: variant.label,
    };
  }
  return {
    productId: product.id,
    lineId: lineKey(product.id),
    title: product.title,
    image: product.image,
    unit: product.unit,
    price: product.price,
    qty,
  };
}

function isCartItem(entry: unknown): entry is CartItem {
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as CartItem).productId === "string" &&
    typeof (entry as CartItem).qty === "number"
  );
}

function readStored(key: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Backfill `lineId` for carts saved before variants existed.
    return parsed.filter(isCartItem).map((item) => ({ ...item, lineId: lineIdOf(item) }));
  } catch {
    return [];
  }
}

function writeStored(key: string, items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* quota / private-mode — fail silently */
  }
}

/** Union two carts, summing quantities for the same line (product + variant). */
function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...a, ...b]) {
    const key = lineIdOf(item);
    const existing = map.get(key);
    map.set(
      key,
      existing ? { ...existing, qty: existing.qty + item.qty } : { ...item, lineId: key },
    );
  }
  return [...map.values()];
}

/** One-time migration of the legacy single-cart key into the guest bucket. */
function migrateLegacy(): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy != null && window.localStorage.getItem(GUEST_KEY) == null) {
      window.localStorage.setItem(GUEST_KEY, legacy);
    }
    if (legacy != null) window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { account, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  // The storage key the current `items` were loaded from; null until first load.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Storage key for the active identity.
  const storageKey = account
    ? `${USER_PREFIX}${account.email || account.phone || "user"}`
    : GUEST_KEY;

  // Load the right cart whenever the identity changes (after auth settles).
  useEffect(() => {
    if (authLoading) return;
    if (loadedKey === storageKey) return;

    migrateLegacy();
    let next = readStored(storageKey);

    // Signing in: fold any guest-cart items into the account cart, then clear
    // the guest bucket so they aren't double-counted or shown after sign-out.
    if (storageKey.startsWith(USER_PREFIX)) {
      const guestItems = readStored(GUEST_KEY);
      if (guestItems.length > 0) {
        next = mergeCarts(next, guestItems);
        writeStored(storageKey, next);
        writeStored(GUEST_KEY, []);
      }
    }

    setItems(next);
    setLoadedKey(storageKey);
  }, [authLoading, storageKey, loadedKey]);

  // Persist whenever items change — but only once they belong to the active
  // identity (guards against writing the previous identity's items on switch).
  useEffect(() => {
    if (loadedKey === null || loadedKey !== storageKey) return;
    writeStored(loadedKey, items);
  }, [items, loadedKey, storageKey]);

  const addItem = useCallback(
    (product: ProductCard, qty = 1, variant?: CartVariantInput) => {
      if (qty <= 0) return;
      const id = lineKey(product.id, variant?.id);
      setItems((prev) => {
        const existing = prev.find((item) => lineIdOf(item) === id);
        if (existing) {
          return prev.map((item) =>
            lineIdOf(item) === id ? { ...item, qty: item.qty + qty } : item,
          );
        }
        return [...prev, toCartItem(product, qty, variant)];
      });
    },
    [],
  );

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((item) => lineIdOf(item) !== lineId));
  }, []);

  const updateQty = useCallback((lineId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((item) => lineIdOf(item) !== lineId)
        : prev.map((item) => (lineIdOf(item) === lineId ? { ...item, qty } : item)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, addItem, removeItem, updateQty, clear, count, subtotal }),
    [items, addItem, removeItem, updateQty, clear, count, subtotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Access the cart: items + mutators + derived count/subtotal. */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a <CartProvider>");
  return ctx;
}
