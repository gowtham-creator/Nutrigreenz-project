/**
 * Referral engine (Milestone 2) — server-side source of truth.
 *
 * Economics live in the singleton `public.referral_config` (id = 1). A referral
 * is a single row in `public.referral_attributions` keyed uniquely to the
 * REFEREE, so a person can be referred exactly once. It starts `pending` at
 * signup and flips to `rewarded` when the referee's first QUALIFYING order
 * confirms — at which point the referrer is credited loyalty points and the
 * referee is credited redeemable store-credit points worth the configured
 * discount. All money is INTEGER PAISE. Service-role only (RLS on / no policies).
 */
import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { getLoyaltyConfig } from "@/lib/rewards";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz-project.vercel.app";

export interface ReferralConfig {
  referrerPoints: number;
  refereeDiscountPaise: number;
  minQualifyingOrderPaise: number;
  maxPerMonth: number;
  expiryDays: number;
  enabled: boolean;
  blockSameDevice: boolean;
  dedupeMobile: boolean;
}

const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  referrerPoints: 200,
  refereeDiscountPaise: 10000,
  minQualifyingOrderPaise: 49900,
  maxPerMonth: 10,
  expiryDays: 30,
  enabled: true,
  blockSameDevice: true,
  dedupeMobile: true,
};

export type ReferralStatus = "pending" | "rewarded" | "void";

export interface ReferralAttribution {
  id: string;
  referrerCustomerId: string;
  refereeCustomerId: string;
  refereeCodeUsed: string | null;
  status: ReferralStatus;
  qualifyingOrderId: string | null;
  referrerPointsAwarded: number;
  refereeDiscountPaiseAwarded: number;
  createdAt: string;
  rewardedAt: string | null;
}

export interface RecordAttributionInput {
  refereeCustomerId: string;
  code: string;
  ip?: string | null;
  deviceHash?: string | null;
}

export type RecordAttributionResult =
  | { ok: true; attributionId: string }
  | { ok: false; reason: string };

const nonNegInt = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;

/** Load the singleton referral config, falling back to the seeded defaults. */
export async function getReferralConfig(): Promise<ReferralConfig> {
  if (!isSupabaseConfigured) return DEFAULT_REFERRAL_CONFIG;
  try {
    const { data } = await supabaseAdmin()
      .from("referral_config")
      .select(
        "referrer_points, referee_discount_paise, min_qualifying_order_paise, max_per_month, expiry_days, enabled, block_same_device, dedupe_mobile",
      )
      .eq("id", 1)
      .maybeSingle();
    if (!data) return DEFAULT_REFERRAL_CONFIG;
    const r = data as Record<string, unknown>;
    return {
      referrerPoints: nonNegInt(r.referrer_points, DEFAULT_REFERRAL_CONFIG.referrerPoints),
      refereeDiscountPaise: nonNegInt(r.referee_discount_paise, DEFAULT_REFERRAL_CONFIG.refereeDiscountPaise),
      minQualifyingOrderPaise: nonNegInt(r.min_qualifying_order_paise, DEFAULT_REFERRAL_CONFIG.minQualifyingOrderPaise),
      maxPerMonth: nonNegInt(r.max_per_month, DEFAULT_REFERRAL_CONFIG.maxPerMonth),
      expiryDays: nonNegInt(r.expiry_days, DEFAULT_REFERRAL_CONFIG.expiryDays),
      enabled: r.enabled !== false,
      blockSameDevice: r.block_same_device !== false,
      dedupeMobile: r.dedupe_mobile !== false,
    };
  } catch {
    return DEFAULT_REFERRAL_CONFIG;
  }
}

/* ── share codes ──────────────────────────────────────────────────────── */

// Crockford-ish base32 minus ambiguous chars (no I, L, O, U) — unambiguous when
// read off a screen or spoken aloud.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomCode(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** The customer's stable share code, minting + persisting one on first request. */
export async function getOrCreateReferralCode(customerId: string): Promise<string | null> {
  if (!customerId || !isSupabaseConfigured) return null;
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("customers")
    .select("referral_code")
    .eq("id", customerId)
    .maybeSingle();
  const current = (existing as { referral_code: string | null } | null)?.referral_code;
  if (current) return current;

  // Mint one, retrying on the (rare) unique collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const { error } = await db
      .from("customers")
      .update({ referral_code: code })
      .eq("id", customerId)
      .is("referral_code", null);
    if (!error) {
      // Confirm it stuck (another writer may have won the race).
      const { data } = await db
        .from("customers")
        .select("referral_code")
        .eq("id", customerId)
        .maybeSingle();
      const stored = (data as { referral_code: string | null } | null)?.referral_code;
      if (stored) return stored;
    }
  }
  return null;
}

/** Resolve a share code to its owning (referrer) customer id, or null. */
export async function resolveCodeToReferrer(code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !isSupabaseConfigured) return null;
  const { data } = await supabaseAdmin()
    .from("customers")
    .select("id")
    .eq("referral_code", normalized)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/* ── attribution ──────────────────────────────────────────────────────── */

/**
 * Record ONE attribution (referee → referrer). Enforces: programme enabled,
 * referee not already attributed, no self-referral, and the configured
 * anti-abuse guards (mobile dedupe, same-device block). Never throws — returns
 * a typed result so callers can fire-and-forget on the signup path.
 */
export async function recordAttribution(
  input: RecordAttributionInput,
): Promise<RecordAttributionResult> {
  try {
    if (!isSupabaseConfigured) return { ok: false, reason: "unconfigured" };
    const config = await getReferralConfig();
    if (!config.enabled) return { ok: false, reason: "disabled" };

    const db = supabaseAdmin();
    const referrerId = await resolveCodeToReferrer(input.code);
    if (!referrerId) return { ok: false, reason: "unknown-code" };
    if (referrerId === input.refereeCustomerId) return { ok: false, reason: "self-referral" };

    // Already attributed? (unique on referee — cheap short-circuit.)
    const { data: existing } = await db
      .from("referral_attributions")
      .select("id")
      .eq("referee_customer_id", input.refereeCustomerId)
      .maybeSingle();
    if (existing) return { ok: false, reason: "already-attributed" };

    // Mobile dedupe — block when the referee's phone was already referred on a
    // different customer record.
    if (config.dedupeMobile) {
      const { data: refereeRow } = await db
        .from("customers")
        .select("primary_phone")
        .eq("id", input.refereeCustomerId)
        .maybeSingle();
      const phone = (refereeRow as { primary_phone: string | null } | null)?.primary_phone;
      if (phone) {
        const { data: sameName } = await db
          .from("customers")
          .select("id")
          .eq("primary_phone", phone);
        const ids = ((sameName as { id: string }[] | null) ?? []).map((r) => r.id);
        if (ids.length > 0) {
          const { data: dupe } = await db
            .from("referral_attributions")
            .select("id")
            .in("referee_customer_id", ids)
            .limit(1);
          if ((dupe as { id: string }[] | null)?.length) return { ok: false, reason: "mobile-dedupe" };
        }
      }
    }

    // Same-device block.
    if (config.blockSameDevice && input.deviceHash) {
      const { data: dev } = await db
        .from("referral_attributions")
        .select("id")
        .eq("signup_device_hash", input.deviceHash)
        .limit(1);
      if ((dev as { id: string }[] | null)?.length) return { ok: false, reason: "same-device" };
    }

    const { data: inserted, error } = await db
      .from("referral_attributions")
      .insert({
        referrer_customer_id: referrerId,
        referee_customer_id: input.refereeCustomerId,
        referee_code_used: input.code.trim().toUpperCase(),
        status: "pending",
        signup_ip: input.ip ?? null,
        signup_device_hash: input.deviceHash ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error || !inserted) return { ok: false, reason: "insert-failed" };

    // Stamp the audit backlink (best-effort).
    await db
      .from("customers")
      .update({ referred_by_code: input.code.trim().toUpperCase() })
      .eq("id", input.refereeCustomerId);

    return { ok: true, attributionId: (inserted as { id: string }).id };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/* ── reward ───────────────────────────────────────────────────────────── */

/**
 * Reward the referral tied to an order's customer, IF eligible. Idempotent:
 * claims the pending attribution with a conditional update before crediting, so
 * concurrent calls can never double-pay. No-op when nothing qualifies.
 */
export async function rewardReferralIfEligible(orderId: string): Promise<void> {
  try {
    if (!orderId || !isSupabaseConfigured) return;
    const db = supabaseAdmin();

    const { data: orderRow } = await db
      .from("orders")
      .select("id, customer_id, subtotal_paise")
      .eq("id", orderId)
      .maybeSingle();
    const order = orderRow as { id: string; customer_id: string | null; subtotal_paise: number } | null;
    if (!order?.customer_id) return;

    const { data: attrRow } = await db
      .from("referral_attributions")
      .select("id, referrer_customer_id, referee_customer_id, created_at, status")
      .eq("referee_customer_id", order.customer_id)
      .eq("status", "pending")
      .maybeSingle();
    const attr = attrRow as
      | { id: string; referrer_customer_id: string; referee_customer_id: string; created_at: string }
      | null;
    if (!attr) return;

    const config = await getReferralConfig();

    // Order must meet the qualifying minimum.
    if (Math.max(0, Math.round(order.subtotal_paise)) < config.minQualifyingOrderPaise) return;

    // Within the referral's expiry window.
    const created = new Date(attr.created_at).getTime();
    if (Number.isFinite(created) && config.expiryDays > 0) {
      const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
      if (ageDays > config.expiryDays) return;
    }

    // Referrer's monthly cap (rewarded this calendar month).
    if (config.maxPerMonth > 0) {
      const start = new Date();
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1).toISOString();
      const { count } = await db
        .from("referral_attributions")
        .select("id", { count: "exact", head: true })
        .eq("referrer_customer_id", attr.referrer_customer_id)
        .eq("status", "rewarded")
        .gte("rewarded_at", monthStart);
      if ((count ?? 0) >= config.maxPerMonth) return;
    }

    // Referee credit: the ₹ discount expressed as redeemable points at the live
    // redeem rate, so it is worth the configured amount as store credit.
    const loyalty = await getLoyaltyConfig();
    const refereePoints = Math.round(
      (config.refereeDiscountPaise / 100) * Math.max(1, loyalty.redeemPointsPerRupee),
    );

    // CLAIM first (pending → rewarded) so a concurrent call can't double-credit.
    const { data: claimed } = await db
      .from("referral_attributions")
      .update({
        status: "rewarded",
        qualifying_order_id: order.id,
        referrer_points_awarded: config.referrerPoints,
        referee_discount_paise_awarded: config.refereeDiscountPaise,
        rewarded_at: new Date().toISOString(),
      })
      .eq("id", attr.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) return; // someone else already rewarded it

    // Credit both ledgers (append-only; balance is SUM(delta_points)).
    if (config.referrerPoints > 0) {
      await db.from("loyalty_ledger").insert({
        customer_id: attr.referrer_customer_id,
        order_id: order.id,
        delta_points: config.referrerPoints,
        reason: "referral_referrer",
      });
    }
    if (refereePoints > 0) {
      await db.from("loyalty_ledger").insert({
        customer_id: attr.referee_customer_id,
        order_id: order.id,
        delta_points: refereePoints,
        reason: "referral_referee",
      });
    }
  } catch {
    /* best-effort — never disrupt the order path */
  }
}

/** Mark a rewarded referral void when its qualifying order is cancelled/refunded. */
export async function voidReferralForOrder(orderId: string): Promise<void> {
  try {
    if (!orderId || !isSupabaseConfigured) return;
    await supabaseAdmin()
      .from("referral_attributions")
      .update({ status: "void" })
      .eq("qualifying_order_id", orderId)
      .eq("status", "rewarded");
  } catch {
    /* best-effort */
  }
}

/* ── customer + admin reads ───────────────────────────────────────────── */

export interface CustomerReferralSummary {
  code: string | null;
  link: string | null;
  rewardedCount: number;
}

/** The signed-in customer's own code, share link, and how many referrals paid. */
export async function getCustomerReferralSummary(
  customerId: string,
): Promise<CustomerReferralSummary> {
  const code = await getOrCreateReferralCode(customerId);
  let rewardedCount = 0;
  if (isSupabaseConfigured) {
    const { count } = await supabaseAdmin()
      .from("referral_attributions")
      .select("id", { count: "exact", head: true })
      .eq("referrer_customer_id", customerId)
      .eq("status", "rewarded");
    rewardedCount = count ?? 0;
  }
  return {
    code,
    link: code ? `${SITE}/r/${code}` : null,
    rewardedCount,
  };
}

export interface AdminReferralRow {
  id: string;
  status: ReferralStatus;
  referrerName: string | null;
  referrerEmail: string | null;
  refereeName: string | null;
  refereeEmail: string | null;
  referrerPointsAwarded: number;
  refereeDiscountPaiseAwarded: number;
  createdAt: string;
  rewardedAt: string | null;
}

export interface AdminReferralPage {
  rows: AdminReferralRow[];
  total: number;
  rewarded: number;
  pending: number;
}

/** Admin reporting: attributions (newest first) + headline counts. */
export async function listReferralAttributions(
  limit = 100,
  offset = 0,
): Promise<AdminReferralPage> {
  if (!isSupabaseConfigured) return { rows: [], total: 0, rewarded: 0, pending: 0 };
  const db = supabaseAdmin();

  const { data, count } = await db
    .from("referral_attributions")
    .select(
      "id, status, referrer_customer_id, referee_customer_id, referrer_points_awarded, referee_discount_paise_awarded, created_at, rewarded_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const rowsRaw = (data as Array<Record<string, unknown>> | null) ?? [];
  const ids = new Set<string>();
  for (const r of rowsRaw) {
    ids.add(String(r.referrer_customer_id));
    ids.add(String(r.referee_customer_id));
  }
  const nameByCustomer = new Map<string, { name: string | null; email: string | null }>();
  if (ids.size > 0) {
    const { data: custs } = await db
      .from("customers")
      .select("id, display_name, primary_email")
      .in("id", Array.from(ids));
    for (const c of (custs as Array<{ id: string; display_name: string | null; primary_email: string | null }> | null) ?? []) {
      nameByCustomer.set(c.id, { name: c.display_name, email: c.primary_email });
    }
  }

  const rows: AdminReferralRow[] = rowsRaw.map((r) => {
    const referrer = nameByCustomer.get(String(r.referrer_customer_id));
    const referee = nameByCustomer.get(String(r.referee_customer_id));
    const status = (r.status === "rewarded" || r.status === "void" ? r.status : "pending") as ReferralStatus;
    return {
      id: String(r.id),
      status,
      referrerName: referrer?.name ?? null,
      referrerEmail: referrer?.email ?? null,
      refereeName: referee?.name ?? null,
      refereeEmail: referee?.email ?? null,
      referrerPointsAwarded: nonNegInt(r.referrer_points_awarded, 0),
      refereeDiscountPaiseAwarded: nonNegInt(r.referee_discount_paise_awarded, 0),
      createdAt: String(r.created_at),
      rewardedAt: r.rewarded_at ? String(r.rewarded_at) : null,
    };
  });

  const [{ count: rewarded }, { count: pending }] = await Promise.all([
    db.from("referral_attributions").select("id", { count: "exact", head: true }).eq("status", "rewarded"),
    db.from("referral_attributions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return { rows, total: count ?? rows.length, rewarded: rewarded ?? 0, pending: pending ?? 0 };
}
