/**
 * Promotions data-access + pricing engine (Supabase `public.promotions`).
 *
 * A promotion is an occasion / seasonal sale: a banner background, a headline,
 * and a whole-percent markdown that is applied to the catalogue's integer-paise
 * prices at read time (storefront cards) and at order time (server-recomputed
 * line prices). This module is the SINGLE source of truth for "which promo
 * applies to a product and by how much", so every surface stays consistent.
 *
 * Service-role only — import from Node route handlers / Server Components, never
 * client/Edge (RLS on `public.promotions` has no policies; only the service-role
 * client can touch it). The public storefront reaches the hero promotion through
 * the unauthenticated /api/promotions/active route.
 *
 * Resilience: reads NEVER throw. When Supabase is unconfigured or a query fails,
 * the resolvers return empty lists / null and the pricing helpers leave prices
 * unchanged, so the shop and checkout keep working during a misconfiguration.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/* ── banner keys (the nine shipped backgrounds) ───────────────────────────── */

/** The nine ready banner backgrounds at /images/banners/sale-<key>.webp. */
export const BANNER_KEYS = [
  "ganesh-chaturthi",
  "diwali",
  "ugadi",
  "sankranti",
  "dussehra",
  "summer-end",
  "winter-end",
  "end-of-season",
  "end-of-month",
] as const;

export type BannerKey = (typeof BANNER_KEYS)[number];

/** Whether `value` is one of the nine allowed banner keys (route validation). */
export function isBannerKey(value: unknown): value is BannerKey {
  return typeof value === "string" && (BANNER_KEYS as readonly string[]).includes(value);
}

/* ── record + input shapes ────────────────────────────────────────────────── */

/** Targeting mode for a promotion. */
export type PromotionScope = "all" | "category" | "product";

/** A persisted promotion, camelCased. Percent is a whole 1..90. */
export interface PromotionRecord {
  id: string;
  title: string;
  slug: string;
  bannerKey: string;
  headline: string;
  subcopy: string | null;
  discountPercent: number;
  scope: PromotionScope;
  scopeValues: string[];
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  ctaLabel: string;
  ctaHref: string;
  autoMonth: boolean;
  priority: number;
  announcement: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The fields the admin API accepts when creating a promotion. */
export interface PromotionInput {
  title: string;
  /** Generated from `title` when omitted. */
  slug?: string;
  bannerKey: string;
  headline: string;
  subcopy?: string | null;
  announcement?: string | null;
  discountPercent: number;
  scope?: PromotionScope;
  scopeValues?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  autoMonth?: boolean;
  priority?: number;
}

/** A partial edit of a promotion's terms (the slug itself is immutable). */
export interface PromotionPatch {
  title?: string;
  bannerKey?: string;
  headline?: string;
  subcopy?: string | null;
  announcement?: string | null;
  discountPercent?: number;
  scope?: PromotionScope;
  scopeValues?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  autoMonth?: boolean;
  priority?: number;
}

/* ── row shape + mapper ───────────────────────────────────────────────────── */

interface PromotionRow {
  id: string;
  title: string;
  slug: string;
  banner_key: string;
  headline: string;
  subcopy: string | null;
  announcement: string | null;
  discount_percent: number;
  scope: string;
  scope_values: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  cta_label: string;
  cta_href: string;
  auto_month: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

const PROMO_COLS =
  "id, title, slug, banner_key, headline, subcopy, announcement, discount_percent, scope, scope_values, starts_at, ends_at, active, cta_label, cta_href, auto_month, priority, created_at, updated_at";

function toScope(raw: string): PromotionScope {
  return raw === "category" || raw === "product" ? raw : "all";
}

function toPromotion(r: PromotionRow): PromotionRecord {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    bannerKey: r.banner_key,
    headline: r.headline,
    subcopy: r.subcopy,
    announcement: r.announcement,
    discountPercent: r.discount_percent,
    scope: toScope(r.scope),
    scopeValues: r.scope_values ?? [],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    ctaLabel: r.cta_label,
    ctaHref: r.cta_href,
    autoMonth: r.auto_month,
    priority: r.priority,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Turn a title into a URL-safe slug (lowercase, hyphenated, ascii-ish). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── reads (never throw) ──────────────────────────────────────────────────── */

/** Every promotion, highest priority first then oldest — for the admin table. */
export async function listPromotions(): Promise<PromotionRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("promotions")
      .select(PROMO_COLS)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    return ((data as PromotionRow[] | null) ?? []).map(toPromotion);
  } catch {
    return [];
  }
}

/**
 * The promotions that are LIVE at `now`: `active`, started (or no start bound),
 * and not yet ended (or no end bound). Ordered by priority desc then created_at
 * so the first row is the one to feature.
 */
export async function getActivePromotions(
  now: Date = new Date(),
): Promise<PromotionRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("promotions")
      .select(PROMO_COLS)
      .eq("active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    const rows = ((data as PromotionRow[] | null) ?? []).map(toPromotion);
    const t = now.getTime();
    return rows.filter((p) => {
      const startsOk = p.startsAt === null || new Date(p.startsAt).getTime() <= t;
      const endsOk = p.endsAt === null || new Date(p.endsAt).getTime() >= t;
      return startsOk && endsOk;
    });
  } catch {
    return [];
  }
}

/** English month name for `now`, e.g. "July". */
function monthName(now: Date): string {
  return now.toLocaleString("en-US", { month: "long" });
}

/**
 * Resolve a reusable `auto_month` promotion for display: substitute the `{month}`
 * token in every text field with the current month name, and — when no token is
 * present — fall back to a "<Month> Sale" title/headline. Non-auto promotions are
 * returned unchanged.
 */
function resolveForDisplay(promo: PromotionRecord, now: Date): PromotionRecord {
  if (!promo.autoMonth) return promo;
  const month = monthName(now);
  const sub = (s: string): string => s.replace(/\{month\}/gi, month);
  const subNullable = (s: string | null): string | null => (s === null ? null : sub(s));
  const hasToken = /\{month\}/i.test(
    `${promo.title} ${promo.headline} ${promo.subcopy ?? ""} ${promo.ctaLabel} ${promo.announcement ?? ""}`,
  );
  return {
    ...promo,
    title: hasToken ? sub(promo.title) : `${month} Sale`,
    headline: hasToken ? sub(promo.headline) : `${month} Sale`,
    subcopy: subNullable(promo.subcopy),
    announcement: subNullable(promo.announcement),
    ctaLabel: sub(promo.ctaLabel),
  };
}

/**
 * The single hero promotion to feature at `now`, already resolved for display
 * (auto-month substitution applied). Returns null when nothing is live.
 */
export async function getHeroPromotion(
  now: Date = new Date(),
): Promise<PromotionRecord | null> {
  const active = await getActivePromotions(now);
  const top = active[0];
  return top ? resolveForDisplay(top, now) : null;
}

/**
 * Short marquee lines for the storefront top announcement bar — one per active
 * promotion, resolved for display. Uses the explicit `announcement` when set,
 * else a line built from the title + discount. Uses the short-lived active-promo
 * cache so it's cheap on every render.
 */
export async function getActivePromoMessages(): Promise<string[]> {
  const now = new Date();
  const active = await getActivePromotionsCached();
  return active
    .map((p) => resolveForDisplay(p, now))
    .map((p) => p.announcement?.trim() || `${p.title} · ${p.discountPercent}% OFF · ${p.ctaLabel}`);
}

/* ── pricing engine (pure) ────────────────────────────────────────────────── */

/** The product facets a promotion can target. */
export interface PromoProduct {
  slug: string;
  categorySlug?: string | null;
  tags?: readonly string[];
}

/**
 * The HIGHEST applicable discount percent for a product across the given active
 * promotions, or 0 when none apply. `all` always applies; `category` matches on
 * the product's category slug OR any of its tags; `product` matches on its slug.
 */
export function promoPercentForProduct(
  product: PromoProduct,
  activePromos: readonly PromotionRecord[],
): number {
  let best = 0;
  for (const promo of activePromos) {
    if (promo.discountPercent <= best) continue; // can't beat the current best
    let applies = false;
    if (promo.scope === "all") {
      applies = true;
    } else if (promo.scope === "category") {
      const inCategory =
        product.categorySlug != null && promo.scopeValues.includes(product.categorySlug);
      const inTags = product.tags?.some((tag) => promo.scopeValues.includes(tag)) ?? false;
      applies = inCategory || inTags;
    } else {
      applies = promo.scopeValues.includes(product.slug);
    }
    if (applies) best = promo.discountPercent;
  }
  return best;
}

/** Apply a whole-percent markdown to a paise amount (rounded to the paisa). */
export function applyPromoPaise(paise: number, percent: number): number {
  return Math.round((paise * (100 - percent)) / 100);
}

/* ── active-promo cache (display surfaces only) ───────────────────────────── */

let activeCache: { at: number; promos: PromotionRecord[] } | null = null;
// Short TTL so a promo toggled in admin surfaces on the storefront within seconds
// (paired with a revalidatePath from the admin mutation routes). The order path
// never uses this cache — it always resolves promos fresh for paisa-exact totals.
const ACTIVE_CACHE_TTL_MS = 15_000;

/**
 * {@link getActivePromotions} with a short (60s) in-process cache, for hot
 * display paths (catalog build, hero banner) that don't need paisa-exact
 * freshness. The order path always calls the uncached resolver for accuracy.
 */
export async function getActivePromotionsCached(): Promise<PromotionRecord[]> {
  const now = Date.now();
  if (activeCache && now - activeCache.at < ACTIVE_CACHE_TTL_MS) return activeCache.promos;
  const promos = await getActivePromotions(new Date(now));
  activeCache = { at: now, promos };
  return promos;
}

/** Drop the cached active-promotions snapshot after a mutation. */
function invalidateActiveCache(): void {
  activeCache = null;
}

/* ── admin CRUD ───────────────────────────────────────────────────────────── */

function normaliseScopeValues(values: readonly string[] | undefined): string[] {
  if (!values) return [];
  return Array.from(
    new Set(values.map((v) => v.trim()).filter((v) => v.length > 0)),
  );
}

/**
 * Create a promotion. Validates the banner key + percent, derives a slug from the
 * title when none is given, and returns the persisted row. Throws on a duplicate
 * slug or a DB error so the route can answer 400 with the reason.
 */
export async function createPromotion(input: PromotionInput): Promise<PromotionRecord> {
  const title = input.title.trim();
  if (!title) throw new Error("title-required");
  if (!isBannerKey(input.bannerKey)) throw new Error("invalid-banner-key");
  const headline = input.headline.trim();
  if (!headline) throw new Error("headline-required");
  const percent = Math.round(input.discountPercent);
  if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
    throw new Error("invalid-discount-percent");
  }
  const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title)) || slugify(title);
  if (!slug) throw new Error("invalid-slug");

  const row: Record<string, unknown> = {
    title,
    slug,
    banner_key: input.bannerKey,
    headline,
    subcopy: input.subcopy?.trim() || null,
    announcement: input.announcement?.trim() || null,
    discount_percent: percent,
    scope: input.scope ?? "all",
    scope_values: normaliseScopeValues(input.scopeValues),
    active: input.active ?? true,
    auto_month: input.autoMonth ?? false,
    priority: Math.round(input.priority ?? 0),
  };
  if (input.startsAt !== undefined) row.starts_at = input.startsAt;
  if (input.endsAt !== undefined) row.ends_at = input.endsAt;
  if (input.ctaLabel !== undefined && input.ctaLabel.trim()) row.cta_label = input.ctaLabel.trim();
  if (input.ctaHref !== undefined && input.ctaHref.trim()) row.cta_href = input.ctaHref.trim();

  const { data, error } = await supabaseAdmin()
    .from("promotions")
    .insert(row)
    .select(PROMO_COLS)
    .single();
  if (error || !data) {
    throw new Error(error?.code === "23505" ? "slug-exists" : error?.message ?? "create-failed");
  }
  invalidateActiveCache();
  return toPromotion(data as PromotionRow);
}

/**
 * Edit a promotion's terms (its slug is immutable). Returns the fresh row, or
 * null when no promotion has that id. Throws on validation / DB errors.
 */
export async function updatePromotion(
  id: string,
  patch: PromotionPatch,
): Promise<PromotionRecord | null> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error("title-required");
    update.title = title;
  }
  if (patch.bannerKey !== undefined) {
    if (!isBannerKey(patch.bannerKey)) throw new Error("invalid-banner-key");
    update.banner_key = patch.bannerKey;
  }
  if (patch.headline !== undefined) {
    const headline = patch.headline.trim();
    if (!headline) throw new Error("headline-required");
    update.headline = headline;
  }
  if (patch.subcopy !== undefined) update.subcopy = patch.subcopy?.trim() || null;
  if (patch.announcement !== undefined) update.announcement = patch.announcement?.trim() || null;
  if (patch.discountPercent !== undefined) {
    const percent = Math.round(patch.discountPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
      throw new Error("invalid-discount-percent");
    }
    update.discount_percent = percent;
  }
  if (patch.scope !== undefined) update.scope = patch.scope;
  if (patch.scopeValues !== undefined) update.scope_values = normaliseScopeValues(patch.scopeValues);
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.ctaLabel !== undefined) update.cta_label = patch.ctaLabel.trim() || "Shop the sale";
  if (patch.ctaHref !== undefined) update.cta_href = patch.ctaHref.trim() || "/shop";
  if (patch.autoMonth !== undefined) update.auto_month = patch.autoMonth;
  if (patch.priority !== undefined) update.priority = Math.round(patch.priority);

  if (Object.keys(update).length === 0) {
    // Nothing to change — return the current row so the caller can 200/404.
    const { data } = await supabaseAdmin().from("promotions").select(PROMO_COLS).eq("id", id).maybeSingle();
    return data ? toPromotion(data as PromotionRow) : null;
  }

  const { data, error } = await supabaseAdmin()
    .from("promotions")
    .update(update)
    .eq("id", id)
    .select(PROMO_COLS)
    .maybeSingle();
  if (error) {
    throw new Error(error.code === "23505" ? "slug-exists" : error.message);
  }
  invalidateActiveCache();
  return data ? toPromotion(data as PromotionRow) : null;
}

/** Whether a delete found and removed a promotion. */
export type PromotionRemoval = "deleted" | "not-found";

/**
 * Delete a promotion outright. Promotions carry no redemption history to keep
 * (unlike coupons), so a hard delete is safe. Returns "not-found" when no row
 * matched the id.
 */
export async function deletePromotion(id: string): Promise<PromotionRemoval> {
  const { data, error } = await supabaseAdmin()
    .from("promotions")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  invalidateActiveCache();
  return data ? "deleted" : "not-found";
}

/** Whether the promotions backend is usable (Supabase configured). */
export function isPromotionsBackendReady(): boolean {
  return isSupabaseConfigured;
}
