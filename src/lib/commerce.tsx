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
import type { CommerceRules, DeliverySlot } from "@/types/nutrigreenz";

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
  /*
   * No built-in slots. Slots only ever come from the live config: built-in
   * ones were shown whenever the live list was empty or not loaded yet, which
   * offered customers windows the shop had switched off (and ids the order
   * API now refuses). Checkout waits for `slotsStatus` instead.
   */
  deliverySlots: [],
  shippingType: "flat",
  shippingSlabs: [],
  taxRateBps: 0,
  currency: "INR",
};

/** Public storefront endpoint exposing the live (Super-Admin) commerce config. */
const PUBLIC_RULES_ENDPOINT = "/api/commerce-rules";

const STORAGE_KEY = "ng.commerce.v1";

/**
 * Whether `rules.deliverySlots` is the shop's live list yet: "loading" until
 * the public config answers, "failed" when it could not be read.
 */
export type SlotsStatus = "loading" | "live" | "failed";

interface CommerceConfigValue {
  /** The live commerce rules (defaults merged with any persisted edits). */
  rules: CommerceRules;
  slotsStatus: SlotsStatus;
  /** Read the live config again (checkout calls this when a slot closes under it). */
  refreshRules: () => Promise<void>;
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
    // Never restored from storage: a slot saved on an earlier visit may have
    // been switched off since. The live read below supplies them.
    deliverySlots: [],
    shippingType:
      v.shippingType === "flat" || v.shippingType === "slab" || v.shippingType === "zero"
        ? v.shippingType
        : COMMERCE_RULES.shippingType,
    shippingSlabs: Array.isArray(v.shippingSlabs)
      ? v.shippingSlabs.filter(
          (s): s is { upto: number; fee: number } =>
            !!s && typeof s.upto === "number" && typeof s.fee === "number",
        )
      : COMMERCE_RULES.shippingSlabs,
    taxRateBps:
      typeof v.taxRateBps === "number" ? v.taxRateBps : COMMERCE_RULES.taxRateBps,
    currency: typeof v.currency === "string" ? v.currency : COMMERCE_RULES.currency,
  };
}

/* ── live public-API read ─────────────────────────────────────────────── */

/** Shape of the customer-facing payload from `GET /api/commerce-rules` (paise). */
interface PublicRulesPayload {
  minOrderPaise: number;
  freeDeliveryThresholdPaise: number;
  shippingType: "flat" | "slab" | "zero";
  shippingFlatPaise: number;
  shippingSlabs: { uptoPaise: number; feePaise: number }[];
  taxMode: "inclusive" | "exclusive";
  taxRateBps: number;
  currency: string;
  deliverySlots: { id: string; label: string; windowText: string | null }[];
}

const paiseToRupees = (paise: number): number =>
  Number.isFinite(paise) ? Math.round(paise) / 100 : 0;

/** Map the paise-based public payload into the rupee-based client `CommerceRules`. */
function fromPublicPayload(p: PublicRulesPayload): CommerceRules {
  const slots: DeliverySlot[] = Array.isArray(p.deliverySlots)
    ? p.deliverySlots.map((s) => ({
        id: s.id,
        label: s.label,
        windowText: s.windowText ?? undefined,
        // Legacy slots carried an "order by" cutoff; live config slots don't.
        cutoff: "",
      }))
    : [];

  return {
    minOrderValue: paiseToRupees(p.minOrderPaise),
    freeDeliveryThreshold: paiseToRupees(p.freeDeliveryThresholdPaise),
    shippingFlat: paiseToRupees(p.shippingFlatPaise),
    taxMode: p.taxMode === "exclusive" ? "exclusive" : "inclusive",
    // An empty list means no slot is active: checkout says so and stops.
    deliverySlots: slots,
    shippingType:
      p.shippingType === "slab" || p.shippingType === "zero" ? p.shippingType : "flat",
    shippingSlabs: Array.isArray(p.shippingSlabs)
      ? p.shippingSlabs.map((s) => ({
          upto: paiseToRupees(s.uptoPaise),
          fee: paiseToRupees(s.feePaise),
        }))
      : [],
    taxRateBps: typeof p.taxRateBps === "number" ? p.taxRateBps : 0,
    currency: typeof p.currency === "string" ? p.currency : "INR",
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
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>("loading");

  /** Fetch the LIVE Super-Admin config; resolves to whether it was applied. */
  const fetchLive = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const res = await fetch(PUBLIC_RULES_ENDPOINT, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { ok?: boolean; rules?: PublicRulesPayload };
      if (!data?.ok || !data.rules) throw new Error("no rules");
      if (isCancelled()) return;
      setRules(fromPublicPayload(data.rules));
      setSlotsStatus("live");
    } catch {
      /* offline / unavailable — keep the cached/default rules, but say so */
      if (!isCancelled()) setSlotsStatus("failed");
    }
  }, []);

  // Hydrate from localStorage after mount (avoids SSR mismatch), then fetch the
  // LIVE Super-Admin config from the public API so the storefront's economics
  // (MOV, free-delivery, shipping, tax, slots) always reflect the latest rules.
  useEffect(() => {
    setRules(readStoredRules());
    setHydrated(true);

    let cancelled = false;
    void fetchLive(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchLive]);

  const refreshRules = useCallback(async () => {
    setSlotsStatus("loading");
    await fetchLive();
  }, [fetchLive]);

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
    () => ({ rules, slotsStatus, refreshRules, updateRules, resetRules }),
    [rules, slotsStatus, refreshRules, updateRules, resetRules],
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

/** Whether the delivery slots are the live list yet, and a way to re-read them. */
export function useCommerceStatus(): { slotsStatus: SlotsStatus; refreshRules: () => Promise<void> } {
  const { slotsStatus, refreshRules } = useCommerceContext();
  return { slotsStatus, refreshRules };
}

/** Read + mutate the commerce rules (used by the Super Admin UI). */
export function useCommerceConfig(): CommerceConfigValue {
  return useCommerceContext();
}
