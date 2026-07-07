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

/* ── program constants (mirror LOYALTY_CONFIG in src/lib/loyalty-config) ── */

/** Earn: 1 point per whole ₹10 (1000 paise) of the payable order total. */
export const EARN_PAISE_PER_POINT = 1000;
/** Redeem: 10 points = ₹1, i.e. 1 point = 10 paise. */
export const REDEEM_PAISE_PER_POINT = 10;
/** A redemption needs at least this many points banked. */
export const MIN_REDEEM_POINTS = 100;
/** A redemption may cover at most this percentage of the order subtotal. */
export const MAX_REDEEM_PERCENT = 20;

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
  | "customer-limit";

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
  "id, code, kind, value, min_order_paise, cap_paise, active, starts_at, ends_at, usage_limit, per_customer_limit, used_count, created_at, updated_at";
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
  if (coupon.perCustomerLimit !== null && customerId) {
    const { count } = await supabaseAdmin()
      .from("coupon_uses")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("customer_id", customerId);
    if ((count ?? 0) >= coupon.perCustomerLimit) return reject("customer-limit");
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
 * Accrue earn points for a placed order: 1 point per whole ₹10 of the PAYABLE
 * total (post-discount, incl. shipping/tax) — never the pre-discount subtotal.
 * Appends an `order_earn` row and returns the points credited (0 on any error,
 * so a bookkeeping hiccup can't void an already-placed order).
 */
export async function earnPointsForOrder(
  customerId: string,
  orderId: string,
  totalPaise: number,
): Promise<number> {
  if (!customerId || !isSupabaseConfigured) return 0;
  const points = Math.floor(Math.max(0, Math.round(totalPaise)) / EARN_PAISE_PER_POINT);
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
 * Clamp a requested redemption WITHOUT writing anything. Guardrails:
 *   - the customer must have banked at least {@link MIN_REDEEM_POINTS};
 *   - never more points than the live balance (no negative balances);
 *   - the paise value may cover at most {@link MAX_REDEEM_PERCENT}% of the
 *     subtotal, and never more than what a coupon left on the table
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

  const balance = await loyaltyBalance(customerId);
  if (balance < MIN_REDEEM_POINTS) return none;

  const subtotal = Math.max(0, Math.round(subtotalPaise));
  const reserved = Math.max(0, Math.round(reservedDiscountPaise));
  const capPaise = Math.min(
    Math.floor((subtotal * MAX_REDEEM_PERCENT) / 100),
    Math.max(0, subtotal - reserved),
  );
  const points = Math.min(requested, balance, Math.floor(capPaise / REDEEM_PAISE_PER_POINT));
  if (points <= 0) return none;
  return { points, discountPaise: points * REDEEM_PAISE_PER_POINT };
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
}

/** Create a coupon (code stored UPPERCASE) and return the fresh record. */
export async function createCoupon(input: CouponInput): Promise<CouponRecord> {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Coupon code is required.");
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
      per_customer_limit:
        input.perCustomerLimit === undefined
          ? 1
          : input.perCustomerLimit === null
            ? null
            : Math.max(1, Math.round(input.perCustomerLimit)),
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
