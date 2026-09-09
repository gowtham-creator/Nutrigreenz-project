/**
 * DB-backed storefront feature flags (Supabase `public.feature_flags`, one row
 * per capability keyed by a stable string). The storefront reads these to gate
 * Subscriptions / Referrals / Community bundles / Captain network platform-wide,
 * replacing the old per-page hardcoded booleans.
 *
 * Service-role only — import from Node route handlers, never client/Edge. Reads
 * fall back to the built-in defaults so an unconfigured DB or a missing row can
 * never crash a page; unknown stored keys are ignored.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/* ── known flags ──────────────────────────────────────────────────────────
 * The canonical set the storefront + Super Admin recognise. Labels/descriptions
 * mirror the admin config surface (src/app/admin/config/page.tsx) and the seed
 * in the create_rewards_config migration.
 */

export type FeatureFlagKey =
  | "subscriptions"
  | "referrals"
  | "community_bundles"
  | "captain_network"
  | "auto_product_badges";

export interface FeatureFlagMeta {
  key: FeatureFlagKey;
  label: string;
  description: string;
  /** Shipped default when no row exists yet (mirrors the migration seed). */
  defaultEnabled: boolean;
}

export const FEATURE_FLAGS: readonly FeatureFlagMeta[] = [
  {
    key: "subscriptions",
    label: "Subscriptions",
    description: "Recurring boxes with pause / skip",
    defaultEnabled: true,
  },
  {
    key: "referrals",
    label: "Referrals",
    description: "Refer-a-friend rewards programme",
    defaultEnabled: true,
  },
  {
    key: "community_bundles",
    label: "Community bundles",
    description: "Captain-led group orders",
    defaultEnabled: true,
  },
  {
    key: "captain_network",
    label: "Captain network",
    description: "Field-pickup captain PWA",
    defaultEnabled: false,
  },
  {
    key: "auto_product_badges",
    /*
     * Defaults ON, which is safe because the badge rules carry their own
     * volume floors: with the current order history nothing qualifies, so
     * enabling it shows nothing until real sales justify it. The switch is
     * here for the case where an operator wants the storefront quiet during
     * a campaign, not as a guard against premature badges.
     */
    label: "Automatic product badges",
    description: 'Show "Best Seller" and "Selling Fast" from paid order volume',
    defaultEnabled: true,
  },
];

/** A plain key → enabled map — the shape the storefront consumes. */
export type FeatureFlagMap = Record<FeatureFlagKey, boolean>;

/** Fallback map (mirrors the migration seed + FEATURE_FLAGS defaults). */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagMap = {
  subscriptions: true,
  referrals: true,
  community_bundles: true,
  captain_network: false,
  auto_product_badges: true,
};

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  updated_at: string;
}

/** A flag row enriched with its display metadata — the admin list shape. */
export interface FeatureFlagRecord extends FeatureFlagMeta {
  enabled: boolean;
  updatedAt: string | null;
}

/* ── reads ────────────────────────────────────────────────────────────── */

/**
 * Read every known flag as a key → enabled map, layering the stored rows over
 * the shipped defaults. Unknown stored keys are ignored and any missing flag
 * falls back to its default, so the storefront always gets a complete map.
 */
export async function getFeatureFlags(): Promise<FeatureFlagMap> {
  const flags: FeatureFlagMap = { ...DEFAULT_FEATURE_FLAGS };
  if (!isSupabaseConfigured) return flags;
  const { data } = await supabaseAdmin().from("feature_flags").select("key, enabled");
  for (const row of (data as { key: string; enabled: boolean }[] | null) ?? []) {
    if (row.key in flags) flags[row.key as FeatureFlagKey] = row.enabled === true;
  }
  return flags;
}

/**
 * The admin list: every known flag with its label/description, live enabled
 * state and last-edited timestamp (null when the row has never been touched).
 */
export async function listFeatureFlags(): Promise<FeatureFlagRecord[]> {
  const stored = new Map<string, { enabled: boolean; updatedAt: string | null }>();
  if (isSupabaseConfigured) {
    const { data } = await supabaseAdmin().from("feature_flags").select("key, enabled, updated_at");
    for (const row of (data as FeatureFlagRow[] | null) ?? []) {
      stored.set(row.key, { enabled: row.enabled === true, updatedAt: row.updated_at ?? null });
    }
  }
  return FEATURE_FLAGS.map((meta) => {
    const s = stored.get(meta.key);
    return {
      ...meta,
      enabled: s ? s.enabled : meta.defaultEnabled,
      updatedAt: s ? s.updatedAt : null,
    };
  });
}

/* ── writes ───────────────────────────────────────────────────────────── */

/** An editable subset of flags, each keyed by its stable string. */
export type FeatureFlagPatch = Partial<Record<FeatureFlagKey, boolean>>;

/**
 * Upsert the supplied flags (only known keys with a boolean value are written,
 * so a stray key can never seed a bogus row), then return the fresh admin list.
 */
export async function updateFeatureFlags(patch: FeatureFlagPatch): Promise<FeatureFlagRecord[]> {
  const rows: { key: FeatureFlagKey; enabled: boolean }[] = [];
  for (const meta of FEATURE_FLAGS) {
    const val = patch[meta.key];
    if (typeof val === "boolean") rows.push({ key: meta.key, enabled: val });
  }
  if (rows.length > 0) {
    const { error } = await supabaseAdmin()
      .from("feature_flags")
      .upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
  }
  return listFeatureFlags();
}
