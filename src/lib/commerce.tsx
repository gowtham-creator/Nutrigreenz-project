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
import type { CommerceRules } from "@/types/nutrigreenz";

/**
 * Storefront commerce rules.
 *
 * These are the *defaults*. A Super Admin can edit them at runtime; edits are
 * persisted to localStorage (`ng.commerce.v1`) and drive the live storefront
 * (cart / checkout). The store mirrors the SSR-safe localStorage pattern used
 * by `cart.tsx` (hydrate-after-mount + persist-on-change).
 */
export const COMMERCE_RULES: CommerceRules = {
  minOrderValue: 300,
  freeDeliveryThreshold: 599,
  shippingFlat: 40,
  taxMode: "inclusive",
  deliverySlots: [
    { id: "morning", label: "Morning · 7–10 AM", cutoff: "22:00" },
    { id: "midday", label: "Midday · 11 AM–2 PM", cutoff: "08:00" },
    { id: "evening", label: "Evening · 5–8 PM", cutoff: "13:00" },
  ],
};

const STORAGE_KEY = "ng.commerce.v1";

interface CommerceConfigValue {
  /** The live commerce rules (defaults merged with any persisted edits). */
  rules: CommerceRules;
  /** Shallow-merge a partial patch into the rules and persist. */
  updateRules: (patch: Partial<CommerceRules>) => void;
  /** Restore the built-in defaults (and clear persisted edits). */
  resetRules: () => void;
}

const CommerceContext = createContext<CommerceConfigValue | null>(null);

/** Coerce arbitrary stored JSON into a valid CommerceRules, falling back to defaults. */
function normalizeRules(value: unknown): CommerceRules {
  if (typeof value !== "object" || value === null) return COMMERCE_RULES;
  const v = value as Partial<CommerceRules>;
  return {
    minOrderValue:
      typeof v.minOrderValue === "number"
        ? v.minOrderValue
        : COMMERCE_RULES.minOrderValue,
    freeDeliveryThreshold:
      typeof v.freeDeliveryThreshold === "number"
        ? v.freeDeliveryThreshold
        : COMMERCE_RULES.freeDeliveryThreshold,
    shippingFlat:
      typeof v.shippingFlat === "number"
        ? v.shippingFlat
        : COMMERCE_RULES.shippingFlat,
    taxMode:
      v.taxMode === "inclusive" || v.taxMode === "exclusive"
        ? v.taxMode
        : COMMERCE_RULES.taxMode,
    deliverySlots: Array.isArray(v.deliverySlots)
      ? v.deliverySlots
      : COMMERCE_RULES.deliverySlots,
  };
}

function readStoredRules(): CommerceRules {
  if (typeof window === "undefined") return COMMERCE_RULES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return COMMERCE_RULES;
    return normalizeRules(JSON.parse(raw) as unknown);
  } catch {
    return COMMERCE_RULES;
  }
}

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<CommerceRules>(COMMERCE_RULES);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setRules(readStoredRules());
    setHydrated(true);
  }, []);

  // Persist whenever rules change (only after initial hydration).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch {
      /* quota / private-mode — fail silently */
    }
  }, [rules, hydrated]);

  const updateRules = useCallback((patch: Partial<CommerceRules>) => {
    setRules((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetRules = useCallback(() => {
    setRules(COMMERCE_RULES);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const value = useMemo<CommerceConfigValue>(
    () => ({ rules, updateRules, resetRules }),
    [rules, updateRules, resetRules],
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

function useCommerceContext(): CommerceConfigValue {
  const ctx = useContext(CommerceContext);
  if (!ctx) {
    throw new Error("useCommerceRules/useCommerceConfig must be used within a <CommerceProvider>");
  }
  return ctx;
}

/**
 * Read the active commerce rules (min order, shipping, tax mode, slots).
 *
 * Signature is unchanged from the original read-only store: callers receive the
 * live `CommerceRules` object, now backed by the persisted store.
 */
export function useCommerceRules(): CommerceRules {
  return useCommerceContext().rules;
}

/** Read + mutate the commerce rules (used by the Super Admin UI). */
export function useCommerceConfig(): CommerceConfigValue {
  return useCommerceContext();
}
