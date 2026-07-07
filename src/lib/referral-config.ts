/**
 * DB-backed referral programme config (Supabase `public.referral_config`, a
 * single row id = 1). Powers the Super Admin "Referral programme" control and
 * the referral engine that lands in a later slice.
 *
 * Service-role only — import from Node route handlers, never client/Edge. Money
 * fields are integer paise (₹1 = 100 paise); `referrerPoints` is whole loyalty
 * points. The UI converts paise ↔ rupees at the edges.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/* ── types ────────────────────────────────────────────────────────────── */

/** The full singleton referral config, camelCased for the app. */
export interface ReferralProgramConfig {
  /** Loyalty points credited to the referrer after the referee's confirmed order. */
  referrerPoints: number;
  /** ₹ off the referee's first order, in integer paise. */
  refereeDiscountPaise: number;
  /** Subtotal the referee must place to qualify, in integer paise. */
  minQualifyingOrderPaise: number;
  /** Cap on rewarded referrals per referrer per calendar month. */
  maxPerMonth: number;
  /** Referral link / reward validity window, in days. */
  expiryDays: number;
  /** Master switch for the whole referral programme. */
  enabled: boolean;
  /** Reject referee sign-ups from the referrer's device fingerprint. */
  blockSameDevice: boolean;
  /** One reward per unique mobile number. */
  dedupeMobile: boolean;
  /** Flag bursts of referrals sharing one delivery address. */
  blockAddressCluster: boolean;
  updatedAt: string | null;
}

/* ── defaults (mirror the migration's column defaults + referral-config.tsx) ─ */

export const DEFAULT_REFERRAL_CONFIG: ReferralProgramConfig = {
  referrerPoints: 200,
  refereeDiscountPaise: 10000,
  minQualifyingOrderPaise: 49900,
  maxPerMonth: 10,
  expiryDays: 30,
  enabled: true,
  blockSameDevice: true,
  dedupeMobile: true,
  blockAddressCluster: false,
  updatedAt: null,
};

/* ── row shape + mapper ───────────────────────────────────────────────── */

interface ReferralConfigRow {
  referrer_points: number;
  referee_discount_paise: number;
  min_qualifying_order_paise: number;
  max_per_month: number;
  expiry_days: number;
  enabled: boolean;
  block_same_device: boolean;
  dedupe_mobile: boolean;
  block_address_cluster: boolean;
  updated_at: string;
}

const REFERRAL_CONFIG_COLS =
  "referrer_points, referee_discount_paise, min_qualifying_order_paise, max_per_month, expiry_days, enabled, block_same_device, dedupe_mobile, block_address_cluster, updated_at";

/** A non-negative integer, or the fallback when the stored value is unusable. */
function nonNegInt(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function toBool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

function toReferralConfig(r: ReferralConfigRow): ReferralProgramConfig {
  return {
    referrerPoints: nonNegInt(r.referrer_points, DEFAULT_REFERRAL_CONFIG.referrerPoints),
    refereeDiscountPaise: nonNegInt(r.referee_discount_paise, DEFAULT_REFERRAL_CONFIG.refereeDiscountPaise),
    minQualifyingOrderPaise: nonNegInt(
      r.min_qualifying_order_paise,
      DEFAULT_REFERRAL_CONFIG.minQualifyingOrderPaise,
    ),
    maxPerMonth: nonNegInt(r.max_per_month, DEFAULT_REFERRAL_CONFIG.maxPerMonth),
    expiryDays: nonNegInt(r.expiry_days, DEFAULT_REFERRAL_CONFIG.expiryDays),
    enabled: toBool(r.enabled, DEFAULT_REFERRAL_CONFIG.enabled),
    blockSameDevice: toBool(r.block_same_device, DEFAULT_REFERRAL_CONFIG.blockSameDevice),
    dedupeMobile: toBool(r.dedupe_mobile, DEFAULT_REFERRAL_CONFIG.dedupeMobile),
    blockAddressCluster: toBool(r.block_address_cluster, DEFAULT_REFERRAL_CONFIG.blockAddressCluster),
    updatedAt: r.updated_at ?? null,
  };
}

/* ── reads + writes ───────────────────────────────────────────────────── */

/**
 * Read the singleton referral config. Returns the built-in defaults when the DB
 * is unconfigured or the row is missing, so callers never crash.
 */
export async function getReferralConfig(): Promise<ReferralProgramConfig> {
  if (!isSupabaseConfigured) return DEFAULT_REFERRAL_CONFIG;
  const { data } = await supabaseAdmin()
    .from("referral_config")
    .select(REFERRAL_CONFIG_COLS)
    .eq("id", 1)
    .maybeSingle();
  return data ? toReferralConfig(data as ReferralConfigRow) : DEFAULT_REFERRAL_CONFIG;
}

export interface ReferralConfigPatch {
  referrerPoints?: number;
  refereeDiscountPaise?: number;
  minQualifyingOrderPaise?: number;
  maxPerMonth?: number;
  expiryDays?: number;
  enabled?: boolean;
  blockSameDevice?: boolean;
  dedupeMobile?: boolean;
  blockAddressCluster?: boolean;
}

/**
 * Apply an editable subset of fields to the singleton row (upserting id = 1 so
 * the row is recreated if it was ever cleared), and return the fresh config.
 */
export async function updateReferralConfig(patch: ReferralConfigPatch): Promise<ReferralProgramConfig> {
  const db = supabaseAdmin();
  const row: Record<string, unknown> = { id: 1 };
  if (patch.referrerPoints !== undefined) row.referrer_points = Math.max(0, Math.round(patch.referrerPoints));
  if (patch.refereeDiscountPaise !== undefined)
    row.referee_discount_paise = Math.max(0, Math.round(patch.refereeDiscountPaise));
  if (patch.minQualifyingOrderPaise !== undefined)
    row.min_qualifying_order_paise = Math.max(0, Math.round(patch.minQualifyingOrderPaise));
  if (patch.maxPerMonth !== undefined) row.max_per_month = Math.max(0, Math.round(patch.maxPerMonth));
  if (patch.expiryDays !== undefined) row.expiry_days = Math.max(0, Math.round(patch.expiryDays));
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.blockSameDevice !== undefined) row.block_same_device = patch.blockSameDevice;
  if (patch.dedupeMobile !== undefined) row.dedupe_mobile = patch.dedupeMobile;
  if (patch.blockAddressCluster !== undefined) row.block_address_cluster = patch.blockAddressCluster;

  const { data, error } = await db
    .from("referral_config")
    .upsert(row, { onConflict: "id" })
    .select(REFERRAL_CONFIG_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to save referral config.");
  return toReferralConfig(data as ReferralConfigRow);
}
