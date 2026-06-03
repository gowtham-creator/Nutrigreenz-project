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
import type { CartItem, ProductCard } from "@/types/nutrigreenz";

const STORAGE_KEY = "ng.cart.v1";

interface CartContextValue {
  items: CartItem[];
  /** Add a product to the cart (or increment its quantity if already present). */
  addItem: (product: ProductCard, qty?: number) => void;
  /** Remove a line item entirely by product id. */
  removeItem: (id: string) => void;
  /** Set the quantity of a line item; quantities <= 0 remove the item. */
  updateQty: (id: string, qty: number) => void;
  /** Empty the cart. */
  clear: () => void;
  /** Total number of units across all line items. */
  count: number;
  /** Sum of price × qty across all line items (₹). */
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function toCartItem(product: ProductCard, qty: number): CartItem {
  return {
    productId: product.id,
    title: product.title,
    image: product.image,
    unit: product.unit,
    price: product.price,
    qty,
  };
}

function readStoredItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CartItem =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as CartItem).productId === "string" &&
        typeof (entry as CartItem).qty === "number",
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
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

  const addItem = useCallback((product: ProductCard, qty = 1) => {
    if (qty <= 0) return;
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + qty } : item,
        );
      }
      return [...prev, toCartItem(product, qty)];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((item) => item.productId !== id)
        : prev.map((item) => (item.productId === id ? { ...item, qty } : item)),
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
