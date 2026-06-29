"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PdpVariant } from "./variant-selector";

/**
 * Shares the selected size × pack variant across the PDP so the BuyPanel and the
 * scroll-in StickyBar always agree: whatever the shopper picks in the panel is
 * exactly what the sticky bar adds to the bag.
 */
interface PdpVariantContextValue {
  variants: PdpVariant[];
  index: number;
  setIndex: (i: number) => void;
  selected: PdpVariant | undefined;
}

const PdpVariantContext = createContext<PdpVariantContextValue | null>(null);

export function PdpVariantProvider({
  variants,
  initialIndex = 0,
  children,
}: {
  variants: PdpVariant[];
  initialIndex?: number;
  children: ReactNode;
}) {
  const safeInitial = Math.min(Math.max(0, initialIndex), Math.max(0, variants.length - 1));
  const [index, setIndex] = useState(safeInitial);
  const selected = variants[index] ?? variants[0];
  const value = useMemo<PdpVariantContextValue>(
    () => ({ variants, index, setIndex, selected }),
    [variants, index, selected],
  );
  return <PdpVariantContext.Provider value={value}>{children}</PdpVariantContext.Provider>;
}

/** Read the shared PDP variant selection (null when used outside a provider). */
export function usePdpVariant(): PdpVariantContextValue | null {
  return useContext(PdpVariantContext);
}
