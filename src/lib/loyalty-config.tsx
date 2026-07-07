"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Loyalty programme configuration (client-side read model).
 *
 * The canonical config lives server-side in Supabase (`public.loyalty_config`),
 * edited by a Super Admin via `/api/admin/config/loyalty`. This provider reads
 * the customer-facing subset from the public `/api/loyalty-config` endpoint so
 * the storefront checkout uses the SAME live economics for everyone — replacing
 * the old per-browser localStorage config. Falls back to the built-in defaults
 * until the fetch resolves (or if it fails), so checkout never breaks.
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

interface LoyaltyConfigValue {
  config: LoyaltyConfig;
}

const LoyaltyConfigContext = createContext<LoyaltyConfigValue | null>(null);

/**
 * Coerce the public API payload into a valid LoyaltyConfig, falling back to
 * defaults per-field. The public endpoint omits `expiryMonths` (not needed by
 * the storefront), so that always resolves to the default here.
 */
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

export function LoyaltyConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LoyaltyConfig>(LOYALTY_CONFIG);

  // Pull the live economics from the public endpoint after mount. Read-only —
  // edits happen in the Super Admin control center against the admin API.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/loyalty-config", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; config?: unknown };
        if (!cancelled && data.ok !== false && data.config) {
          setConfig(normalizeConfig(data.config));
        }
      } catch {
        /* offline / unconfigured — keep the built-in defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LoyaltyConfigValue>(() => ({ config }), [config]);

  return (
    <LoyaltyConfigContext.Provider value={value}>
      {children}
    </LoyaltyConfigContext.Provider>
  );
}

/** Read the live loyalty programme config (storefront checkout). */
export function useLoyaltyConfig(): LoyaltyConfigValue {
  const ctx = useContext(LoyaltyConfigContext);
  if (!ctx) {
    throw new Error("useLoyaltyConfig must be used within a <LoyaltyConfigProvider>");
  }
  return ctx;
}
