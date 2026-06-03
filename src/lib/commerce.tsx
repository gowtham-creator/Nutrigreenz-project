"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CommerceRules } from "@/types/nutrigreenz";

/**
 * Storefront commerce rules.
 *
 * Mocked in the front-end for now — a Super Admin edits these from the admin
 * portal in a later phase. The values are read-only at runtime here.
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

const CommerceContext = createContext<CommerceRules>(COMMERCE_RULES);

export function CommerceProvider({
  children,
  rules = COMMERCE_RULES,
}: {
  children: ReactNode;
  /** Override for tests / future admin-driven values. Defaults to the mock. */
  rules?: CommerceRules;
}) {
  return <CommerceContext.Provider value={rules}>{children}</CommerceContext.Provider>;
}

/** Read the active commerce rules (min order, shipping, tax mode, slots). */
export function useCommerceRules(): CommerceRules {
  return useContext(CommerceContext);
}
