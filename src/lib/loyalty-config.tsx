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

/**
 * Loyalty programme configuration.
 *
 * Editable by a Super Admin and persisted to localStorage (`ng.loyalty.v1`).
 * The storefront checkout reads `redeemPointsPerRupee` (and the redemption
 * limits) from here so changes go live immediately. Mirrors the SSR-safe
 * localStorage pattern used by `cart.tsx`/`commerce.tsx`.
 */
export interface LoyaltyConfig {
  /** Points earned per ₹1 spent. */
  earnPointsPerRupee: number;
  /** Points needed to redeem ₹1 (e.g. 10 pts = ₹1). */
  redeemPointsPerRupee: number;
  /** Minimum points balance required before any redemption is allowed. */
  minRedeemPoints: number;
  /** Max share of the order subtotal (%) that loyalty can cover. */
  maxRedeemPercent: number;
  /** Months until earned points expire. */
  expiryMonths: number;
  /** Whether customers currently earn points on orders. */
  earnEnabled: boolean;
}

/** Sensible defaults: earn 1 pt/₹, redeem 10 pts = ₹1, etc. */
export const LOYALTY_CONFIG: LoyaltyConfig = {
  earnPointsPerRupee: 1,
  redeemPointsPerRupee: 10,
  minRedeemPoints: 100,
  maxRedeemPercent: 20,
  expiryMonths: 12,
  earnEnabled: true,
};

const STORAGE_KEY = "ng.loyalty.v1";

interface LoyaltyConfigValue {
  config: LoyaltyConfig;
  updateConfig: (patch: Partial<LoyaltyConfig>) => void;
  resetConfig: () => void;
}

const LoyaltyConfigContext = createContext<LoyaltyConfigValue | null>(null);

/** Coerce arbitrary stored JSON into a valid LoyaltyConfig, falling back to defaults. */
function normalizeConfig(value: unknown): LoyaltyConfig {
  if (typeof value !== "object" || value === null) return LOYALTY_CONFIG;
  const v = value as Partial<LoyaltyConfig>;
  const num = (n: unknown, fallback: number) =>
    typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return {
    earnPointsPerRupee: num(v.earnPointsPerRupee, LOYALTY_CONFIG.earnPointsPerRupee),
    redeemPointsPerRupee: num(
      v.redeemPointsPerRupee,
      LOYALTY_CONFIG.redeemPointsPerRupee,
    ),
    minRedeemPoints: num(v.minRedeemPoints, LOYALTY_CONFIG.minRedeemPoints),
    maxRedeemPercent: num(v.maxRedeemPercent, LOYALTY_CONFIG.maxRedeemPercent),
    expiryMonths: num(v.expiryMonths, LOYALTY_CONFIG.expiryMonths),
    earnEnabled:
      typeof v.earnEnabled === "boolean" ? v.earnEnabled : LOYALTY_CONFIG.earnEnabled,
  };
}

function readStoredConfig(): LoyaltyConfig {
  if (typeof window === "undefined") return LOYALTY_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return LOYALTY_CONFIG;
    return normalizeConfig(JSON.parse(raw) as unknown);
  } catch {
    return LOYALTY_CONFIG;
  }
}

export function LoyaltyConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LoyaltyConfig>(LOYALTY_CONFIG);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setConfig(readStoredConfig());
    setHydrated(true);
  }, []);

  // Persist whenever config changes (only after initial hydration).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* quota / private-mode — fail silently */
    }
  }, [config, hydrated]);

  const updateConfig = useCallback((patch: Partial<LoyaltyConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(LOYALTY_CONFIG);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const value = useMemo<LoyaltyConfigValue>(
    () => ({ config, updateConfig, resetConfig }),
    [config, updateConfig, resetConfig],
  );

  return (
    <LoyaltyConfigContext.Provider value={value}>
      {children}
    </LoyaltyConfigContext.Provider>
  );
}

/** Read + mutate the loyalty programme config (Super Admin UI + checkout). */
export function useLoyaltyConfig(): LoyaltyConfigValue {
  const ctx = useContext(LoyaltyConfigContext);
  if (!ctx) {
    throw new Error("useLoyaltyConfig must be used within a <LoyaltyConfigProvider>");
  }
  return ctx;
}
