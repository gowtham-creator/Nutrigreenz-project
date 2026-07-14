/**
 * Coupons + loyalty engine (Supabase `public.coupons`, `public.coupon_uses`,
 * `public.loyalty_ledger`). This is the server-side source of truth the
 * create-order path consults in place of the old client-asserted discount
 * amounts: coupons are re-validated against the catalogue + the customer's
 * usage history, and loyalty redemptions are clamped by the live ledger
 * balance plus the program guardrails before a single paisa comes off an order.
 *
 * Service-role only — import from Node route handlers, never client/Edge. All
 * monetary fields are integer paise (₹1 = 100 paise); loyalty amounts are whole
 * points. The ledger is append-only: the balance is SUM(delta_points) and the
 * redeem path never lets it go negative.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import { hasVerifiedPhone } from "@/lib/customer-identity";

/* ── program defaults ──────────────────────────────────────────────────────
 * FALLBACK values only. The live programme config is read from the DB row
 * `public.loyalty_config` via {@link getLoyaltyConfig}; these constants are used
 * solely when Supabase is unconfigured or the row is missing (see
 * {@link DEFAULT_LOYALTY_CONFIG}). REDEEM_PAISE_PER_POINT is the DEFAULT redeem
 * rate only; the create-order route converts a client-sent paise amount back into
 * points using the LIVE rate ({@link redeemPaisePerPoint} over the configured
 * {@link getLoyaltyConfig}), and the server re-clamps the redemption against the
 * live config regardless.
 */

/** Default redeem rate: 10 points = ₹1, i.e. 1 point = 10 paise. */
export const REDEEM_PAISE_PER_POINT = 10;
/** Default floor: a redemption needs at least this many points banked. */
export const MIN_REDEEM_POINTS = 100;
/** Default cap: a redemption may cover at most this percentage of the subtotal. */
export const MAX_REDEEM_PERCENT = 20;

/* ── loyalty programme config (DB-backed, single row) ─────────────────────── */

/**
 * The loyalty programme economics the checkout points engine runs on. Read from
 * the `public.loyalty_config` singleton so a Super Admin edit takes effect
 * server-side for everyone (replacing the old per-browser localStorage config).
 */
export interface LoyaltyProgramConfig {
  /** Points credited per ₹1 of the payable order total. */
  earnPointsPerRupee: number;
  /** Points needed to redeem ₹1 off (10 pts = ₹1). */
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

/** Fallback config (mirrors the migration's column defaults + LOYALTY_CONFIG). */
export const DEFAULT_LOYALTY_CONFIG: LoyaltyProgramConfig = {
  earnPointsPerRupee: 1,
  redeemPointsPerRupee: 10,
  minRedeemPoints: MIN_REDEEM_POINTS,
  maxRedeemPercent: MAX_REDEEM_PERCENT,
  expiryMonths: 12,
  earnEnabled: true,
};

/** The customer-facing subset the public /api/loyalty-config endpoint returns. */
export interface PublicLoyaltyConfig {
  earnPointsPerRupee: number;
  redeemPointsPerRupee: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  earnEnabled: boolean;
}

interface LoyaltyConfigRow {
  earn_points_per_rupee: number;
  redeem_points_per_rupee: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  expiry_months: number;
  earn_enabled: boolean;
}

const LOYALTY_CONFIG_COLS =
  "earn_points_per_rupee, redeem_points_per_rupee, min_redeem_points, max_redeem_percent, expiry_months, earn_enabled";

/** A non-negative integer, or the fallback when the stored value is unusable. */
function nonNegInt(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function toLoyaltyConfig(r: LoyaltyConfigRow): LoyaltyProgramConfig {
  return {
    // Rates must be >= 1 to avoid divide-by-zero / zero-point rounding.
    earnPointsPerRupee: Math.max(1, nonNegInt(r.earn_points_per_rupee, DEFAULT_LOYALTY_CONFIG.earnPointsPerRupee)),
    redeemPointsPerRupee: Math.max(
      1,
      nonNegInt(r.redeem_points_per_rupee, DEFAULT_LOYALTY_CONFIG.redeemPointsPerRupee),
    ),
    minRedeemPoints: nonNegInt(r.min_redeem_points, DEFAULT_LOYALTY_CONFIG.minRedeemPoints),
    maxRedeemPercent: Math.min(100, nonNegInt(r.max_redeem_percent, DEFAULT_LOYALTY_CONFIG.maxRedeemPercent)),
    expiryMonths: nonNegInt(r.expiry_months, DEFAULT_LOYALTY_CONFIG.expiryMonths),
    earnEnabled: typeof r.earn_enabled === "boolean" ? r.earn_enabled : DEFAULT_LOYALTY_CONFIG.earnEnabled,
  };
}

/**
 * Read the singleton loyalty programme config. Returns the built-in defaults
 * when the DB is unconfigured or the row is missing, so callers never crash and
 * the points engine keeps working with sane values.
 */
export async function getLoyaltyConfig(): Promise<LoyaltyProgramConfig> {
  if (!isSupabaseConfigured) return DEFAULT_LOYALTY_CONFIG;
  const { data } = await supabaseAdmin()
    .from("loyalty_config")
    .select(LOYALTY_CONFIG_COLS)
    .eq("id", 1)
    .maybeSingle();
  return data ? toLoyaltyConfig(data as LoyaltyConfigRow) : DEFAULT_LOYALTY_CONFIG;
}

/** The customer-facing rate/min/max slice for the storefront checkout. */
export async function getPublicLoyaltyConfig(): Promise<PublicLoyaltyConfig> {
  const c = await getLoyaltyConfig();
  return {
    earnPointsPerRupee: c.earnPointsPerRupee,
    redeemPointsPerRupee: c.redeemPointsPerRupee,
    minRedeemPoints: c.minRedeemPoints,
    maxRedeemPercent: c.maxRedeemPercent,
    earnEnabled: c.earnEnabled,
  };
}

export interface LoyaltyConfigPatch {
  earnPointsPerRupee?: number;
  redeemPointsPerRupee?: number;
  minRedeemPoints?: number;
  maxRedeemPercent?: number;
  expiryMonths?: number;
  earnEnabled?: boolean;
}

/**
 * Apply an editable subset of fields to the singleton row (upserting id = 1 so
 * the row is recreated if it was ever cleared), and return the fresh config.
 */
export async function updateLoyaltyConfig(patch: LoyaltyConfigPatch): Promise<LoyaltyProgramConfig> {
  const db = supabaseAdmin();
  const row: Record<string, unknown> = { id: 1 };
  if (patch.earnPointsPerRupee !== undefined) row.earn_points_per_rupee = Math.max(0, Math.round(patch.earnPointsPerRupee));
  if (patch.redeemPointsPerRupee !== undefined) row.redeem_points_per_rupee = Math.max(1, Math.round(patch.redeemPointsPerRupee));
  if (patch.minRedeemPoints !== undefined) row.min_redeem_points = Math.max(0, Math.round(patch.minRedeemPoints));
  if (patch.maxRedeemPercent !== undefined)
    row.max_redeem_percent = Math.min(100, Math.max(0, Math.round(patch.maxRedeemPercent)));
  if (patch.expiryMonths !== undefined) row.expiry_months = Math.max(0, Math.round(patch.expiryMonths));
  if (patch.earnEnabled !== undefined) row.earn_enabled = patch.earnEnabled;

  const { data, error } = await db
    .from("loyalty_config")
    .upsert(row, { onConflict: "id" })
    .select(LOYALTY_CONFIG_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to save loyalty config.");
  return toLoyaltyConfig(data as LoyaltyConfigRow);
}

/** Paise redeemed per point, derived from the live redeem rate (₹1 = 100 paise). */
export function redeemPaisePerPoint(config: LoyaltyProgramConfig): number {
  return Math.max(1, Math.round(100 / config.redeemPointsPerRupee));
}

/* ── types ────────────────────────────────────────────────────────────── */

export type CouponKind = "percent" | "flat";

/** A persisted coupon, camelCased. Money in integer paise. */
export interface CouponRecord {
  id: string;
  /** Always UPPERCASE. */
  code: string;
  kind: CouponKind;
  /** Percent coupons: whole percent (10 = 10%). Flat coupons: integer paise. */
  value: number;
  minOrderPaise: number;
  /** Max discount in paise for a percent coupon; null = uncapped. */
  capPaise: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Total redemptions allowed across all customers; null = unlimited. */
  usageLimit: number | null;
  /** Redemptions allowed per customer; null = unlimited. */
  perCustomerLimit: number | null;
  /**
   * Welcome / first-order flag. When true the coupon only validates for a
   * canonical customer that owns an OTP-verified phone, and is enforced as
   * once-per-customer (a null `perCustomerLimit` is treated as 1).
   */
  requiresVerifiedPhone: boolean;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyReason = "order_earn" | "order_redeem" | "adjust";

/** One append-only ledger row. Earn rows are positive, redemptions negative. */
export interface LoyaltyLedgerRecord {
  id: string;
  customerId: string;
  orderId: string | null;
  deltaPoints: number;
  reason: LoyaltyReason;
  createdAt: string;
}

/** Why a coupon was refused by {@link validateCouponServer}. */
export type CouponRejection =
  | "not-found"
  | "inactive"
  | "not-started"
  | "expired"
  | "below-min"
  | "usage-limit"
  | "customer-limit"
  /** Welcome/first-order code applied without an OTP-verified phone on file. */
  | "phone-verification-required";

export interface CouponValidation {
  valid: boolean;
  discountPaise: number;
  reason: CouponRejection | null;
  coupon: CouponRecord | null;
}

/** A clamped loyalty redemption: the points burned and their paise value. */
export interface LoyaltyRedemption {
  points: number;
  discountPaise: number;
}

/**
 * Thrown by the create-order path when a claimed coupon fails re-validation,
 * so the API can answer 400 with the concrete reason instead of a generic 500.
 */
export class CouponInvalidError extends Error {
  readonly reason: CouponRejection;

  constructor(reason: CouponRejection) {
    super(`Coupon rejected: ${reason}`);
    this.name = "CouponInvalidError";
    this.reason = reason;
  }
}

/* ── row shapes + mappers ─────────────────────────────────────────────── */

interface CouponRow {
  id: string;
  code: string;
  kind: string;
  value: number;
  min_order_paise: number;
  cap_paise: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  requires_verified_phone: boolean;
  used_count: number;
  created_at: string;
  updated_at: string;
}

interface LedgerRow {
  id: string;
  customer_id: string;
  order_id: string | null;
  delta_points: number;
  reason: string;
  created_at: string;
}

const COUPON_COLS =
  "id, code, kind, value, min_order_paise, cap_paise, active, starts_at, ends_at, usage_limit, per_customer_limit, requires_verified_phone, used_count, created_at, updated_at";
const LEDGER_COLS = "id, customer_id, order_id, delta_points, reason, created_at";

function toKind(raw: string | null | undefined): CouponKind {
  return raw === "percent" ? "percent" : "flat";
}

function toReason(raw: string | null | undefined): LoyaltyReason {
  return raw === "order_earn" || raw === "order_redeem" ? raw : "adjust";
}

function toCoupon(r: CouponRow): CouponRecord {
  return {
    id: r.id,
    code: r.code,
    kind: toKind(r.kind),
    value: r.value,
    minOrderPaise: r.min_order_paise,
    capPaise: r.cap_paise,
    active: r.active,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    usageLimit: r.usage_limit,
    perCustomerLimit: r.per_customer_limit,
    requiresVerifiedPhone: Boolean(r.requires_verified_phone),
    usedCount: r.used_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toLedgerEntry(r: LedgerRow): LoyaltyLedgerRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    orderId: r.order_id,
    deltaPoints: r.delta_points,
    reason: toReason(r.reason),
    createdAt: r.created_at,
  };
}

/* ── coupon reads + validation ────────────────────────────────────────── */

/** Fetch one coupon by code (case-insensitive; codes are stored UPPERCASE). */
export async function getCoupon(code: string): Promise<CouponRecord | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !isSupabaseConfigured) return null;
  const { data } = await supabaseAdmin()
    .from("coupons")
    .select(COUPON_COLS)
    .eq("code", normalized)
    .maybeSingle();
  return data ? toCoupon(data as CouponRow) : null;
}

/** The discount a coupon yields on a subtotal, capped and never exceeding it. */
function couponDiscountPaise(coupon: CouponRecord, subtotalPaise: number): number {
  const subtotal = Math.max(0, Math.round(subtotalPaise));
  const raw =
    coupon.kind === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : coupon.value;
  const capped =
    coupon.kind === "percent" && coupon.capPaise !== null
      ? Math.min(raw, coupon.capPaise)
      : raw;
  return Math.max(0, Math.min(Math.round(capped), subtotal));
}

/**
 * Authoritative coupon check: existence → active → validity window → minimum
 * order → global usage limit → per-customer limit (counted from `coupon_uses`).
 * Returns the computed discount in paise when valid; a rejection reason when
 * not. Never throws — an unconfigured DB reads as "not-found".
 */
export async function validateCouponServer(
  code: string,
  subtotalPaise: number,
  customerId: string | null,
  now: Date = new Date(),
): Promise<CouponValidation> {
  const reject = (reason: CouponRejection): CouponValidation => ({
    valid: false,
    discountPaise: 0,
    reason,
    coupon: null,
  });

  const coupon = await getCoupon(code);
  if (!coupon) return reject("not-found");
  if (!coupon.active) return reject("inactive");
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return reject("not-started");
  if (coupon.endsAt && new Date(coupon.endsAt) < now) return reject("expired");
  if (Math.max(0, Math.round(subtotalPaise)) < coupon.minOrderPaise) {
    return reject("below-min");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return reject("usage-limit");
  }

  // Welcome / first-order gate: the code only applies for a canonical customer
  // that owns an OTP-VERIFIED phone — this ties the bonus to a deduped identity
  // so the same person can't re-claim it from a fresh login. Fail-safe:
  // hasVerifiedPhone never throws and reads FALSE on any error, so a lookup
  // hiccup REJECTS the bonus (never silently granted). This gate is only reached
  // for coupons an admin explicitly flagged, so a normal order is never touched.
  if (coupon.requiresVerifiedPhone) {
    if (!customerId || !(await hasVerifiedPhone(customerId))) {
      return reject("phone-verification-required");
    }
  }

  // Per-customer cap counted from `coupon_uses`. A welcome code is single-use per
  // canonical customer even when the admin left `per_customer_limit` blank — a
  // null limit resolves to 1 for a verified-phone code (unchanged for others).
  const effectivePerCustomerLimit =
    coupon.perCustomerLimit ?? (coupon.requiresVerifiedPhone ? 1 : null);
  if (effectivePerCustomerLimit !== null && customerId) {
    const { count } = await supabaseAdmin()
      .from("coupon_uses")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("customer_id", customerId);
    if ((count ?? 0) >= effectivePerCustomerLimit) return reject("customer-limit");
  }

  return {
    valid: true,
    discountPaise: couponDiscountPaise(coupon, subtotalPaise),
    reason: null,
    coupon,
  };
}

/**
 * Record a successful redemption: append a `coupon_uses` row, then refresh the
 * denormalised `used_count` by re-counting the uses table (rather than a blind
 * increment) so concurrent redemptions can't drift the counter.
 */
export async function recordCouponUse(
  code: string,
  customerId: string,
  orderId: string | null,
): Promise<void> {
  const coupon = await getCoupon(code);
  if (!coupon || !customerId) return;
  const db = supabaseAdmin();
  const { error } = await db.from("coupon_uses").insert({
    coupon_id: coupon.id,
    customer_id: customerId,
    order_id: orderId,
  });
  if (error) throw new Error(error.message);

  const { count } = await db
    .from("coupon_uses")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", coupon.id);
  await db
    .from("coupons")
    .update({ used_count: count ?? coupon.usedCount + 1 })
    .eq("id", coupon.id);
}

/* ── loyalty ledger ───────────────────────────────────────────────────── */

/** A customer's live points balance — SUM(delta_points) over the ledger. */
export async function loyaltyBalance(customerId: string): Promise<number> {
  if (!customerId || !isSupabaseConfigured) return 0;
  const { data } = await supabaseAdmin()
    .from("loyalty_ledger")
    .select("delta_points")
    .eq("customer_id", customerId);
  const rows = (data as { delta_points: number }[] | null) ?? [];
  return rows.reduce((sum, r) => sum + r.delta_points, 0);
}

/** A customer's most recent ledger entries, newest first. */
export async function listLoyaltyLedger(
  customerId: string,
  limit = 20,
): Promise<LoyaltyLedgerRecord[]> {
  if (!customerId || !isSupabaseConfigured) return [];
  const capped = Math.min(Math.max(1, Math.round(limit)), 100);
  const { data } = await supabaseAdmin()
    .from("loyalty_ledger")
    .select(LEDGER_COLS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(capped);
  return ((data as LedgerRow[] | null) ?? []).map(toLedgerEntry);
}

/**
 * Accrue earn points for a placed order at the live `earnPointsPerRupee` rate on
 * the PAYABLE total (post-discount, incl. shipping/tax) — never the pre-discount
 * subtotal. No-ops when earning is switched off in the config. Appends an
 * `order_earn` row and returns the points credited (0 on any error, so a
 * bookkeeping hiccup can't void an already-placed order).
 */
export async function earnPointsForOrder(
  customerId: string,
  orderId: string,
  totalPaise: number,
): Promise<number> {
  if (!customerId || !isSupabaseConfigured) return 0;
  const config = await getLoyaltyConfig();
  if (!config.earnEnabled) return 0;
  // earnPointsPerRupee is points per ₹1 (= per 100 paise).
  const points = Math.floor((Math.max(0, Math.round(totalPaise)) * config.earnPointsPerRupee) / 100);
  if (points <= 0) return 0;
  const { error } = await supabaseAdmin().from("loyalty_ledger").insert({
    customer_id: customerId,
    order_id: orderId,
    delta_points: points,
    reason: "order_earn",
  });
  return error ? 0 : points;
}

/**
 * Clamp a requested redemption WITHOUT writing anything. Guardrails come from
 * the live loyalty config ({@link getLoyaltyConfig}):
 *   - the customer must have banked at least `minRedeemPoints`;
 *   - never more points than the live balance (no negative balances);
 *   - the paise value may cover at most `maxRedeemPercent`% of the subtotal,
 *     and never more than what a coupon left on the table
 *     (`reservedDiscountPaise`) — coupon + loyalty can't exceed the subtotal.
 * The create-order path quotes first (totals need the number before the order
 * row exists), then commits via {@link redeemPoints} with the order id.
 */
export async function quoteLoyaltyRedemption(
  customerId: string,
  requestedPoints: number,
  subtotalPaise: number,
  reservedDiscountPaise = 0,
): Promise<LoyaltyRedemption> {
  const none: LoyaltyRedemption = { points: 0, discountPaise: 0 };
  const requested = Math.floor(Math.max(0, requestedPoints));
  if (!customerId || requested <= 0 || !isSupabaseConfigured) return none;

  const config = await getLoyaltyConfig();
  const balance = await loyaltyBalance(customerId);
  if (balance < config.minRedeemPoints) return none;

  const subtotal = Math.max(0, Math.round(subtotalPaise));
  const reserved = Math.max(0, Math.round(reservedDiscountPaise));
  const paisePerPoint = redeemPaisePerPoint(config);
  const capPaise = Math.min(
    Math.floor((subtotal * config.maxRedeemPercent) / 100),
    Math.max(0, subtotal - reserved),
  );
  const points = Math.min(requested, balance, Math.floor(capPaise / paisePerPoint));
  if (points <= 0) return none;
  return { points, discountPaise: points * paisePerPoint };
}

/**
 * Burn points against an order: re-apply the {@link quoteLoyaltyRedemption}
 * guardrails against the CURRENT balance (so a stale quote can never drive the
 * ledger negative), then append the negative `order_redeem` row. Returns what
 * was actually redeemed — `{ 0, 0 }` when nothing could be.
 */
export async function redeemPoints(
  customerId: string,
  orderId: string,
  requestedPoints: number,
  subtotalPaise: number,
  reservedDiscountPaise = 0,
): Promise<LoyaltyRedemption> {
  const quote = await quoteLoyaltyRedemption(
    customerId,
    requestedPoints,
    subtotalPaise,
    reservedDiscountPaise,
  );
  if (quote.points <= 0) return quote;

  const { error } = await supabaseAdmin().from("loyalty_ledger").insert({
    customer_id: customerId,
    order_id: orderId,
    delta_points: -quote.points,
    reason: "order_redeem",
  });
  return error ? { points: 0, discountPaise: 0 } : quote;
}

/* ── admin coupon CRUD ────────────────────────────────────────────────── */

/** All coupons, newest first (the admin marketing list). */
export async function listCoupons(): Promise<CouponRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin()
    .from("coupons")
    .select(COUPON_COLS)
    .order("created_at", { ascending: false });
  return ((data as CouponRow[] | null) ?? []).map(toCoupon);
}

export interface CouponInput {
  code: string;
  kind: CouponKind;
  value: number;
  minOrderPaise?: number;
  capPaise?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  /** Welcome / first-order flag — gates the code behind an OTP-verified phone. */
  requiresVerifiedPhone?: boolean;
}

/** Create a coupon (code stored UPPERCASE) and return the fresh record. */
export async function createCoupon(input: CouponInput): Promise<CouponRecord> {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Coupon code is required.");
  const requiresVerifiedPhone = input.requiresVerifiedPhone ?? false;
  const { data, error } = await supabaseAdmin()
    .from("coupons")
    .insert({
      code,
      kind: toKind(input.kind),
      value: Math.max(0, Math.round(input.value)),
      min_order_paise: Math.max(0, Math.round(input.minOrderPaise ?? 0)),
      cap_paise: input.capPaise == null ? null : Math.max(0, Math.round(input.capPaise)),
      active: input.active ?? true,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      usage_limit: input.usageLimit == null ? null : Math.max(0, Math.round(input.usageLimit)),
      // A welcome/first-order code is once-per-customer by definition, so it is
      // never stored as unlimited — a blank/null limit clamps up to 1 when the
      // verified-phone flag is on (ordinary coupons keep their existing rule).
      per_customer_limit:
        input.perCustomerLimit === undefined
          ? 1
          : input.perCustomerLimit === null
            ? requiresVerifiedPhone
              ? 1
              : null
            : Math.max(1, Math.round(input.perCustomerLimit)),
      requires_verified_phone: requiresVerifiedPhone,
    })
    .select(COUPON_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create coupon.");
  return toCoupon(data as CouponRow);
}

export interface CouponPatch {
  kind?: CouponKind;
  value?: number;
  minOrderPaise?: number;
  capPaise?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  requiresVerifiedPhone?: boolean;
}

/**
 * Apply an editable subset of fields to a coupon and return the fresh record.
 * The code itself is immutable once issued — it may already be printed on
 * campaign SMS — so a rename means retiring the coupon and creating a new one.
 */
export async function updateCoupon(
  id: string,
  patch: CouponPatch,
): Promise<CouponRecord | null> {
  const db = supabaseAdmin();
  const row: Record<string, string | number | boolean | null> = {};
  if (patch.kind !== undefined) row.kind = toKind(patch.kind);
  if (patch.value !== undefined) row.value = Math.max(0, Math.round(patch.value));
  if (patch.minOrderPaise !== undefined) {
    row.min_order_paise = Math.max(0, Math.round(patch.minOrderPaise));
  }
  if (patch.capPaise !== undefined) {
    row.cap_paise = patch.capPaise === null ? null : Math.max(0, Math.round(patch.capPaise));
  }
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.usageLimit !== undefined) {
    row.usage_limit = patch.usageLimit === null ? null : Math.max(0, Math.round(patch.usageLimit));
  }
  if (patch.perCustomerLimit !== undefined) {
    row.per_customer_limit =
      patch.perCustomerLimit === null ? null : Math.max(1, Math.round(patch.perCustomerLimit));
  }
  if (patch.requiresVerifiedPhone !== undefined) {
    row.requires_verified_phone = patch.requiresVerifiedPhone;
  }

  if (Object.keys(row).length === 0) {
    const { data } = await db.from("coupons").select(COUPON_COLS).eq("id", id).maybeSingle();
    return data ? toCoupon(data as CouponRow) : null;
  }

  const { data, error } = await db
    .from("coupons")
    .update(row)
    .eq("id", id)
    .select(COUPON_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCoupon(data as CouponRow) : null;
}

export type CouponRemoval = "deleted" | "deactivated" | "not-found";

/**
 * Retire a coupon. A never-used coupon is hard-deleted; one with ANY recorded
 * redemption is only deactivated — the usage history (and the audit trail it
 * gives orders) must survive, so there is no hard delete once used.
 */
export async function removeCoupon(id: string): Promise<CouponRemoval> {
  const db = supabaseAdmin();
  const { data } = await db.from("coupons").select(COUPON_COLS).eq("id", id).maybeSingle();
  if (!data) return "not-found";
  const coupon = toCoupon(data as CouponRow);

  const { count } = await db
    .from("coupon_uses")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", id);
  if ((count ?? 0) > 0 || coupon.usedCount > 0) {
    const { error } = await db.from("coupons").update({ active: false }).eq("id", id);
    if (error) throw new Error(error.message);
    return "deactivated";
  }

  const { error } = await db.from("coupons").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return "deleted";
}

/** Whether the rewards backend is usable (Supabase configured). */
export function isRewardsBackendReady(): boolean {
  return isSupabaseConfigured;
}
