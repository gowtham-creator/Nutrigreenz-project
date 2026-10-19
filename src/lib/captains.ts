/**
 * Captains data-access + day math (Supabase `public.captains` and friends).
 *
 * The single source of truth for the field-sales "captain" module: the roster,
 * the walk-up stall sales a captain captures, their end-of-day settlement, and
 * community pickups. Service-role only — import from Node route handlers, never
 * client/Edge (RLS on every captain table has no policies, so only the
 * service-role client can touch them; mirrors `@/lib/admins`).
 *
 * Money is INTEGER PAISE end-to-end here — totals are recomputed server-side
 * from paise line prices (never a client-supplied total). Rupee⇄paise
 * conversion happens only in the route handlers, at the edge.
 *
 * "Today" is the IST calendar day (this is an India-only business — +91 phones,
 * INR): capture stats and the settlement's `settle_date` are both derived from
 * {@link istDayStartUtcIso} / {@link istToday}, so they always agree regardless
 * of the server's own timezone.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import { findCustomerByPhone } from "@/lib/customer-identity";
import { requireCaptain, type CaptainSessionPayload } from "@/lib/captain-session";
import type {
  Captain,
  CaptainCapture,
  CaptainCaptureItem,
  CaptainPayMode,
  CaptainPickup,
  CaptainPickupStatus,
  CaptainSettlement,
  CaptainStats,
  CaptainWithStats,
} from "@/types/nutrigreenz";

/* ── phone + day helpers ──────────────────────────────────────────────────── */

/** Normalize any input to a bare 10-digit mobile, or null when it isn't one.
 *  Strips a leading +91 / 0 / spaces; a longer string keeps its last 10 digits. */
export function normalizeMobile10(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

const IST_OFFSET_MIN = 330; // Asia/Kolkata, no DST.

/** The UTC instant at which the current IST calendar day began (ISO string). */
function istDayStartUtcIso(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const istMidnightUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(istMidnightUtc - IST_OFFSET_MIN * 60_000).toISOString();
}

/** The current IST calendar day as `YYYY-MM-DD` (the settlement key). */
function istToday(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return ist.toISOString().slice(0, 10);
}

/**
 * Commission in paise for a day's GMV. The percent is turned into whole basis
 * points first so the product stays an exact integer: 500 paise at 0.7% is
 * 3.5 paise and rounds to 4, where `500 * 0.7 / 100` is 3.4999… and rounds to 3.
 */
export function commissionPaiseFor(gmvPaise: number, commissionPercent: number): number {
  const bps = Math.round((Number(commissionPercent) || 0) * 100);
  return Math.round((gmvPaise * bps) / 10_000);
}

/**
 * {@link requireCaptain} plus a live check that the captain still exists, is
 * still active and still owns the phone the session was minted for. The signed
 * cookie alone cannot know that an admin deactivated the captain or moved the
 * number, so every data route goes through this. When the DB is unconfigured
 * the plain session result is returned and each route keeps its own degrade path.
 */
export async function requireActiveCaptain(): Promise<CaptainSessionPayload | Response> {
  const gate = await requireCaptain();
  if (gate instanceof Response || !isSupabaseConfigured) return gate;
  const captain = await getCaptainById(gate.captainId);
  if (!captain || !captain.active || captain.phone !== normalizeMobile10(gate.phone)) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  return gate;
}

/* ── row ⇄ record mappers ─────────────────────────────────────────────────── */

interface CaptainRow {
  id: string;
  name: string;
  phone: string;
  area: string | null;
  stall: string | null;
  communities: string[] | null;
  commission_percent: number | string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CAPTAIN_COLS =
  "id, name, phone, area, stall, communities, commission_percent, active, created_by, created_at, updated_at";

function toCaptain(r: CaptainRow): Captain {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    area: r.area,
    stall: r.stall,
    communities: r.communities ?? [],
    commissionPercent: Number(r.commission_percent) || 0,
    active: r.active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The captain identity the /captain PWA hydrates from (`/api/captain/me`). No
 *  money, no PII beyond what the captain already knows about themselves. */
export interface CaptainMe {
  id: string;
  name: string;
  initials: string;
  area: string | null;
  stall: string | null;
  communities: string[];
  commissionPercent: number;
}

/** Derive a 1–2 letter avatar monogram from a captain's name. */
export function captainInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Project a captain down to the client-facing identity for the field tool. */
export function toCaptainMe(c: Captain): CaptainMe {
  return {
    id: c.id,
    name: c.name,
    initials: captainInitials(c.name),
    area: c.area,
    stall: c.stall,
    communities: c.communities,
    commissionPercent: c.commissionPercent,
  };
}

interface CaptureRow {
  id: string;
  captain_id: string;
  customer_name: string;
  customer_mobile: string;
  community: string | null;
  items: unknown;
  total_paise: number;
  pay_mode: string;
  notes: string | null;
  linked_customer_id: string | null;
  captured_at: string;
}

const CAPTURE_COLS =
  "id, captain_id, customer_name, customer_mobile, community, items, total_paise, pay_mode, notes, linked_customer_id, captured_at";

/** Defensive jsonb → typed line items (stored snake_case, exposed camelCase). */
function parseItems(raw: unknown): CaptainCaptureItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    return {
      sku: String(o.sku ?? ""),
      title: String(o.title ?? ""),
      unit: String(o.unit ?? ""),
      pricePaise: Math.round(Number(o.price_paise ?? 0)) || 0,
      qty: Math.round(Number(o.qty ?? 0)) || 0,
    };
  });
}

function toCapture(r: CaptureRow): CaptainCapture {
  return {
    id: r.id,
    captainId: r.captain_id,
    customerName: r.customer_name,
    customerMobile: r.customer_mobile,
    community: r.community,
    items: parseItems(r.items),
    totalPaise: r.total_paise,
    payMode: r.pay_mode === "upi" ? "upi" : "cash",
    notes: r.notes,
    linkedCustomerId: r.linked_customer_id,
    capturedAt: r.captured_at,
  };
}

interface SettlementRow {
  id: string;
  captain_id: string;
  settle_date: string;
  expected_gmv_paise: number;
  cash_expected_paise: number;
  upi_expected_paise: number;
  cash_counted_paise: number;
  variance_paise: number;
  commission_paise: number;
  submitted_at: string;
}

const SETTLEMENT_COLS =
  "id, captain_id, settle_date, expected_gmv_paise, cash_expected_paise, upi_expected_paise, cash_counted_paise, variance_paise, commission_paise, submitted_at";

function toSettlement(r: SettlementRow): CaptainSettlement {
  return {
    id: r.id,
    captainId: r.captain_id,
    settleDate: r.settle_date,
    expectedGmvPaise: r.expected_gmv_paise,
    cashExpectedPaise: r.cash_expected_paise,
    upiExpectedPaise: r.upi_expected_paise,
    cashCountedPaise: r.cash_counted_paise,
    variancePaise: r.variance_paise,
    commissionPaise: r.commission_paise,
    submittedAt: r.submitted_at,
  };
}

interface PickupRow {
  id: string;
  captain_id: string;
  community: string;
  address: string | null;
  status: string;
  due_at: string | null;
  updated_at: string;
  created_at: string;
}

const PICKUP_COLS =
  "id, captain_id, community, address, status, due_at, updated_at, created_at";

function toPickup(r: PickupRow): CaptainPickup {
  const status: CaptainPickupStatus =
    r.status === "collected" || r.status === "handed_over" ? r.status : "due";
  return {
    id: r.id,
    captainId: r.captain_id,
    community: r.community,
    address: r.address,
    status,
    dueAt: r.due_at,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}

/* ── captains: roster CRUD ────────────────────────────────────────────────── */

export interface NewCaptainInput {
  name: string;
  phone: string;
  area?: string | null;
  stall?: string | null;
  communities?: string[];
  commissionPercent?: number;
  active?: boolean;
  createdBy?: string | null;
}

export interface CaptainUpdateInput {
  name?: string;
  phone?: string;
  area?: string | null;
  stall?: string | null;
  communities?: string[];
  commissionPercent?: number;
  active?: boolean;
}

const ZERO_STATS: CaptainStats = { count: 0, orders: 0, gmvPaise: 0, cashPaise: 0, upiPaise: 0 };

/** Clamp a commission percent into the DB's allowed 0..100 band. */
function clampCommission(pct: number | undefined): number {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/** All captains, newest first. When `withStats`, each carries today's figures
 *  (one grouped query over today's captures — no N+1). */
export async function listCaptains(withStats = false): Promise<CaptainWithStats[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("captains")
    .select(CAPTAIN_COLS)
    .order("created_at", { ascending: false });
  const captains = ((data as CaptainRow[] | null) ?? []).map(toCaptain);
  if (!withStats || captains.length === 0) {
    return captains.map((c) => ({ ...c, todayStats: { ...ZERO_STATS } }));
  }

  const { data: caps } = await db
    .from("captain_captures")
    .select("captain_id, total_paise, pay_mode, items")
    .gte("captured_at", istDayStartUtcIso());
  const byCaptain = new Map<string, CaptainStats>();
  for (const row of (caps as Array<Record<string, unknown>> | null) ?? []) {
    const id = String(row.captain_id);
    const s = byCaptain.get(id) ?? { count: 0, orders: 0, gmvPaise: 0, cashPaise: 0, upiPaise: 0 };
    const total = Math.round(Number(row.total_paise) || 0);
    s.count += 1;
    if (Array.isArray(row.items) && row.items.length > 0) s.orders += 1;
    s.gmvPaise += total;
    if (row.pay_mode === "upi") s.upiPaise += total;
    else s.cashPaise += total;
    byCaptain.set(id, s);
  }
  return captains.map((c) => ({ ...c, todayStats: byCaptain.get(c.id) ?? { ...ZERO_STATS } }));
}

/** A single captain by id, or null. */
export async function getCaptainById(id: string): Promise<Captain | null> {
  const { data } = await supabaseAdmin()
    .from("captains")
    .select(CAPTAIN_COLS)
    .eq("id", id)
    .maybeSingle();
  return data ? toCaptain(data as CaptainRow) : null;
}

/** The captain who owns a given mobile (normalized to 10 digits), or null.
 *  Used by the OTP sign-in to resolve the phone → captain. Never throws. */
export async function getCaptainByPhone(phone: string): Promise<Captain | null> {
  const ten = normalizeMobile10(phone);
  if (!ten) return null;
  try {
    const { data } = await supabaseAdmin()
      .from("captains")
      .select(CAPTAIN_COLS)
      .eq("phone", ten)
      .maybeSingle();
    return data ? toCaptain(data as CaptainRow) : null;
  } catch {
    return null;
  }
}

/** Whether a normalized mobile is already held by a captain (optionally
 *  excluding one id, for edit). Returns true when the number is unusable. */
export async function captainPhoneExists(phone: string, exceptId?: string): Promise<boolean> {
  const ten = normalizeMobile10(phone);
  if (!ten) return true;
  let q = supabaseAdmin().from("captains").select("id").eq("phone", ten);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.maybeSingle();
  return Boolean(data);
}

/** Create a captain. `phone` is normalized to 10 digits; the DB unique index is
 *  the final guard, but callers should check {@link captainPhoneExists} first. */
export async function createCaptain(input: NewCaptainInput): Promise<Captain> {
  const ten = normalizeMobile10(input.phone);
  if (!ten) throw new Error("A valid 10-digit mobile is required.");
  const { data, error } = await supabaseAdmin()
    .from("captains")
    .insert({
      name: input.name.trim(),
      phone: ten,
      area: input.area?.trim() || null,
      stall: input.stall?.trim() || null,
      communities: input.communities ?? [],
      commission_percent: clampCommission(input.commissionPercent),
      active: input.active ?? true,
      created_by: input.createdBy ?? null,
    })
    .select(CAPTAIN_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create captain.");
  return toCaptain(data as CaptainRow);
}

/** Apply an editable subset of fields to a captain and return the fresh record. */
export async function updateCaptain(
  id: string,
  input: CaptainUpdateInput,
): Promise<Captain | null> {
  const patch: Record<string, string | string[] | number | boolean | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.phone !== undefined) {
    const ten = normalizeMobile10(input.phone);
    if (!ten) throw new Error("A valid 10-digit mobile is required.");
    patch.phone = ten;
  }
  if (input.area !== undefined) patch.area = input.area?.trim() || null;
  if (input.stall !== undefined) patch.stall = input.stall?.trim() || null;
  if (input.communities !== undefined) patch.communities = input.communities;
  if (input.commissionPercent !== undefined) {
    patch.commission_percent = clampCommission(input.commissionPercent);
  }
  if (input.active !== undefined) patch.active = input.active;
  if (Object.keys(patch).length === 0) return getCaptainById(id);

  const { data, error } = await supabaseAdmin()
    .from("captains")
    .update(patch)
    .eq("id", id)
    .select(CAPTAIN_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCaptain(data as CaptainRow) : null;
}

/** Soft-disable a captain (they can no longer sign in). */
export async function deactivateCaptain(id: string): Promise<Captain | null> {
  return updateCaptain(id, { active: false });
}

/** Whether a captain has any recorded sales or settlements. Deleting such a
 *  captain would cascade away cash records, so the admin route refuses it. */
export async function captainHasHistory(id: string): Promise<boolean> {
  const db = supabaseAdmin();
  const [caps, sets] = await Promise.all([
    db.from("captain_captures").select("id").eq("captain_id", id).limit(1),
    db.from("captain_settlements").select("id").eq("captain_id", id).limit(1),
  ]);
  // A failed read counts as "has history": fail closed on a destructive action.
  if (caps.error || sets.error) return true;
  return (caps.data?.length ?? 0) > 0 || (sets.data?.length ?? 0) > 0;
}

/** Permanently delete a captain (cascades to captures/settlements/pickups). */
export async function deleteCaptain(id: string): Promise<void> {
  await supabaseAdmin().from("captains").delete().eq("id", id);
}

/* ── captures ─────────────────────────────────────────────────────────────── */

export interface NewCaptureInput {
  customerName: string;
  customerMobile: string;
  community?: string | null;
  /** Line items with INTEGER-PAISE prices (route converts rupees→paise). */
  items: CaptainCaptureItem[];
  payMode: CaptainPayMode;
  notes?: string | null;
  /**
   * The client's id for this sale (the offline outbox's temp id). A retry after
   * a lost response sends the same ref, and the stored capture is returned
   * instead of recording the sale twice.
   */
  clientRef?: string | null;
}

/** PostgREST / Postgres "column does not exist", i.e. the client_ref migration
 *  has not been applied yet. Captures still record; they just are not deduped. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703" || /client_ref/.test(error.message ?? "");
}

async function findCaptureByClientRef(captainId: string, clientRef: string): Promise<CaptureRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("captain_captures")
    .select(CAPTURE_COLS)
    .eq("captain_id", captainId)
    .eq("client_ref", clientRef)
    .maybeSingle();
  if (error || !data) return null;
  return data as CaptureRow;
}

/**
 * Record a walk-up stall sale for a captain. The total is recomputed here from
 * the paise line prices (never trusted from the client). The captured mobile is
 * cross-matched to a canonical customer (best-effort) — a hit stamps
 * `linked_customer_id` so the sale ties back to the deduped person.
 */
export async function addCapture(
  captainId: string,
  input: NewCaptureInput,
): Promise<CaptainCapture> {
  const mobile10 = normalizeMobile10(input.customerMobile) ?? "";
  const clientRef = input.clientRef || null;

  // A retried POST for a sale that already landed: hand back the stored row.
  if (clientRef) {
    const existing = await findCaptureByClientRef(captainId, clientRef);
    if (existing) return toCapture(existing);
  }

  const items = input.items.map((it) => ({
    sku: it.sku,
    title: it.title,
    unit: it.unit,
    price_paise: Math.round(it.pricePaise) || 0,
    qty: Math.round(it.qty) || 0,
    // Carried through so the sale can be joined to the catalogue. The jsonb
    // itself stays a SNAPSHOT of what was charged — a later price change must
    // not rewrite what a customer actually paid.
    variant_id: it.variantId ?? null,
    product_id: it.productId ?? null,
  }));
  const totalPaise = items.reduce((sum, it) => sum + it.price_paise * it.qty, 0);

  // Cross-match the captured mobile to a canonical customer (best-effort — a
  // lookup failure must never block recording the sale).
  let linkedCustomerId: string | null = null;
  if (mobile10) {
    try {
      const customer = await findCustomerByPhone(mobile10);
      linkedCustomerId = customer?.id ?? null;
    } catch {
      linkedCustomerId = null;
    }
  }

  const row: Record<string, unknown> = {
    captain_id: captainId,
    customer_name: input.customerName.trim(),
    customer_mobile: mobile10,
    community: input.community?.trim() || null,
    items,
    total_paise: totalPaise,
    pay_mode: input.payMode,
    notes: input.notes?.trim() || null,
    linked_customer_id: linkedCustomerId,
  };
  const insert = (values: Record<string, unknown>) =>
    supabaseAdmin().from("captain_captures").insert(values).select(CAPTURE_COLS).single();

  let { data, error } = await insert(clientRef ? { ...row, client_ref: clientRef } : row);
  if (error && clientRef && isMissingColumn(error)) {
    ({ data, error } = await insert(row));
  } else if (error && clientRef && error.code === "23505") {
    // Two retries raced past the lookup; the unique index kept one. Return it.
    const existing = await findCaptureByClientRef(captainId, clientRef);
    if (existing) return toCapture(existing);
  }
  if (error || !data) throw new Error(error?.message || "Failed to record capture.");

  /*
   * Mirror the lines into captain_capture_lines so captain sales can be counted
   * per SKU and reconciled against stock. The jsonb above remains the
   * point-of-sale snapshot; these rows are the queryable version.
   *
   * Best-effort: the cash has already been taken and the capture is recorded,
   * so a reporting-table failure must never fail the sale. It is logged instead.
   */
  const captureRow = data as CaptureRow;
  try {
    const lines = items
      .filter((it) => it.qty > 0)
      .map((it) => ({
        capture_id: captureRow.id,
        captain_id: captainId,
        variant_id: it.variant_id,
        product_id: it.product_id,
        sku: it.sku || null,
        title: it.title,
        unit: it.unit,
        qty: it.qty,
        unit_price_paise: it.price_paise,
        line_total_paise: it.price_paise * it.qty,
        captured_at: captureRow.captured_at,
      }));
    if (lines.length > 0) {
      await supabaseAdmin().from("captain_capture_lines").insert(lines);
    }
  } catch (err) {
    console.error("[captains] capture line mirror failed:", err);
  }

  return toCapture(captureRow);
}

/** A captain's captures, newest first. `todayOnly` limits to the IST day. */
export async function listCapturesForCaptain(
  captainId: string,
  todayOnly = false,
  limit = 200,
): Promise<CaptainCapture[]> {
  let q = supabaseAdmin()
    .from("captain_captures")
    .select(CAPTURE_COLS)
    .eq("captain_id", captainId)
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (todayOnly) q = q.gte("captured_at", istDayStartUtcIso());
  const { data } = await q;
  return ((data as CaptureRow[] | null) ?? []).map(toCapture);
}

/** Aggregate a captain's day (IST) into paise figures. */
export async function captainStats(captainId: string, todayOnly = true): Promise<CaptainStats> {
  let q = supabaseAdmin()
    .from("captain_captures")
    .select("total_paise, pay_mode, items")
    .eq("captain_id", captainId);
  if (todayOnly) q = q.gte("captured_at", istDayStartUtcIso());
  const { data } = await q;
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const stats: CaptainStats = { count: 0, orders: 0, gmvPaise: 0, cashPaise: 0, upiPaise: 0 };
  for (const row of rows) {
    const total = Math.round(Number(row.total_paise) || 0);
    stats.count += 1;
    if (Array.isArray(row.items) && row.items.length > 0) stats.orders += 1;
    stats.gmvPaise += total;
    if (row.pay_mode === "upi") stats.upiPaise += total;
    else stats.cashPaise += total;
  }
  return stats;
}

/* ── settlements ──────────────────────────────────────────────────────────── */

/**
 * Upsert a captain's end-of-day cash-up for TODAY (IST). Expected GMV / cash /
 * UPI are recomputed from today's captures; variance = countedCash − expectedCash;
 * commission = round(GMV × commission_percent / 100). One row per captain per day
 * — a re-submit overwrites and refreshes `submitted_at`.
 */
export async function upsertSettlement(
  captainId: string,
  cashCountedPaise: number,
): Promise<CaptainSettlement> {
  const [stats, captain] = await Promise.all([
    captainStats(captainId, true),
    getCaptainById(captainId),
  ]);
  const counted = Math.round(cashCountedPaise) || 0;
  const commissionPct = captain ? captain.commissionPercent : 0;
  const commissionPaise = commissionPaiseFor(stats.gmvPaise, commissionPct);
  const variancePaise = counted - stats.cashPaise;

  const { data, error } = await supabaseAdmin()
    .from("captain_settlements")
    .upsert(
      {
        captain_id: captainId,
        settle_date: istToday(),
        expected_gmv_paise: stats.gmvPaise,
        cash_expected_paise: stats.cashPaise,
        upi_expected_paise: stats.upiPaise,
        cash_counted_paise: counted,
        variance_paise: variancePaise,
        commission_paise: commissionPaise,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "captain_id,settle_date" },
    )
    .select(SETTLEMENT_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to save settlement.");
  return toSettlement(data as SettlementRow);
}

/** A captain's settlements, newest first (for the admin drill-in). */
export async function listSettlementsForCaptain(
  captainId: string,
  limit = 30,
): Promise<CaptainSettlement[]> {
  const { data } = await supabaseAdmin()
    .from("captain_settlements")
    .select(SETTLEMENT_COLS)
    .eq("captain_id", captainId)
    .order("settle_date", { ascending: false })
    .limit(limit);
  return ((data as SettlementRow[] | null) ?? []).map(toSettlement);
}

/* ── pickups ──────────────────────────────────────────────────────────────── */

/** The natural forward transition for a pickup, or null at the end of the line. */
export function nextPickupStatus(status: CaptainPickupStatus): CaptainPickupStatus | null {
  if (status === "due") return "collected";
  if (status === "collected") return "handed_over";
  return null;
}

/** A captain's pickups (due first, then most-recently-updated). */
export async function listPickupsForCaptain(captainId: string): Promise<CaptainPickup[]> {
  const { data } = await supabaseAdmin()
    .from("captain_pickups")
    .select(PICKUP_COLS)
    .eq("captain_id", captainId)
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });
  return ((data as PickupRow[] | null) ?? []).map(toPickup);
}

export type AdvancePickupResult =
  | { ok: true; pickup: CaptainPickup }
  | { ok: false; reason: "not-found" | "invalid_transition"; pickup?: CaptainPickup };

/**
 * Advance a pickup to `status`, scoped to its owning captain (a captain can only
 * touch their OWN pickups). Only the next step is allowed (due → collected →
 * handed_over): no skipping, no going back. Asking for the status it already
 * has is a no-op success, so a double tap or a retried request is harmless.
 * The update is conditional on the status we read, so two racing requests
 * cannot both advance it.
 */
export async function advancePickup(
  pickupId: string,
  captainId: string,
  status: CaptainPickupStatus,
): Promise<AdvancePickupResult> {
  const { data: currentRow, error: readErr } = await supabaseAdmin()
    .from("captain_pickups")
    .select(PICKUP_COLS)
    .eq("id", pickupId)
    .eq("captain_id", captainId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!currentRow) return { ok: false, reason: "not-found" };
  const current = toPickup(currentRow as PickupRow);

  if (current.status === status) return { ok: true, pickup: current };
  if (nextPickupStatus(current.status) !== status) {
    return { ok: false, reason: "invalid_transition", pickup: current };
  }

  const { data, error } = await supabaseAdmin()
    .from("captain_pickups")
    .update({ status })
    .eq("id", pickupId)
    .eq("captain_id", captainId)
    .eq("status", current.status)
    .select(PICKUP_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false, reason: "invalid_transition", pickup: current };
  return { ok: true, pickup: toPickup(data as PickupRow) };
}
