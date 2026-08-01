import { requireCaptain } from "@/lib/captain-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  addCapture,
  captainStats,
  listCapturesForCaptain,
  normalizeMobile10,
} from "@/lib/captains";
import type { CaptainCaptureItem, CaptainPayMode, CaptainStats } from "@/types/nutrigreenz";

/**
 * Captain stall-sale captures — scoped to the signed-in captain only.
 *
 *   GET  /api/captain/captures → today's captures + today's paise stats.
 *   POST /api/captain/captures → record a walk-up sale.
 *
 * MONEY: request line prices arrive in RUPEES (matching the captain's catalog)
 * and are converted to integer paise here; the DB total is recomputed
 * server-side from those paise (never trusted from the client). Every money
 * field in the RESPONSE is integer paise.
 */

const ZERO_STATS: CaptainStats = { count: 0, orders: 0, gmvPaise: 0, cashPaise: 0, upiPaise: 0 };

export async function GET(): Promise<Response> {
  const gate = await requireCaptain();
  if (gate instanceof Response) return gate;
  // Degrade gracefully when the DB is unconfigured — an empty, well-formed day.
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, captures: [], stats: ZERO_STATS });
  }
  const [captures, stats] = await Promise.all([
    listCapturesForCaptain(gate.captainId, true),
    captainStats(gate.captainId, true),
  ]);
  return Response.json({ ok: true, captures, stats });
}

interface RawItem {
  sku?: unknown;
  title?: unknown;
  unit?: unknown;
  price?: unknown;
  qty?: unknown;
  /** Catalogue variant the line was sold from — lets the sale join to a SKU. */
  variantId?: unknown;
  productId?: unknown;
}

/** Coerce a client cart line (rupee price) into a paise line item, or null. */
function toPaiseItem(raw: RawItem): CaptainCaptureItem | null {
  const sku = String(raw.sku ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const unit = String(raw.unit ?? "").trim();
  const priceRupees = Number(raw.price);
  const qty = Math.round(Number(raw.qty));
  if (!sku || !title) return null;
  if (!Number.isFinite(priceRupees) || priceRupees < 0 || priceRupees > 1_000_000) return null;
  if (!Number.isFinite(qty) || qty < 1 || qty > 999) return null;
  // Carried through so the sale joins to the catalogue. Not trusted for
  // pricing — the price is validated separately above.
  const variantId = typeof raw.variantId === "string" && raw.variantId ? raw.variantId : null;
  const productId = typeof raw.productId === "string" && raw.productId ? raw.productId : null;
  return {
    variantId,
    productId, sku, title, unit, pricePaise: Math.round(priceRupees * 100), qty };
}

export async function POST(request: Request): Promise<Response> {
  const gate = await requireCaptain();
  if (gate instanceof Response) return gate;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const mobile = normalizeMobile10(String(body.mobile ?? ""));
  const community = body.community != null ? String(body.community).trim() : null;
  const payModeRaw = String(body.payMode ?? "").toLowerCase();
  const notes = body.notes != null ? String(body.notes).trim() : null;
  const rawItems = Array.isArray(body.items) ? (body.items as RawItem[]) : [];

  if (!name) return Response.json({ ok: false, error: "name_required" }, { status: 400 });
  if (!mobile) return Response.json({ ok: false, error: "invalid_mobile" }, { status: 400 });
  if (payModeRaw !== "cash" && payModeRaw !== "upi") {
    return Response.json({ ok: false, error: "invalid_pay_mode" }, { status: 400 });
  }
  if (rawItems.length === 0 || rawItems.length > 100) {
    return Response.json({ ok: false, error: "invalid_items" }, { status: 400 });
  }
  const items: CaptainCaptureItem[] = [];
  for (const raw of rawItems) {
    const item = toPaiseItem(raw);
    if (!item) return Response.json({ ok: false, error: "invalid_items" }, { status: 400 });
    items.push(item);
  }

  const payMode: CaptainPayMode = payModeRaw === "upi" ? "upi" : "cash";
  const capture = await addCapture(gate.captainId, {
    customerName: name,
    customerMobile: mobile,
    community,
    items,
    payMode,
    notes,
  });
  const stats = await captainStats(gate.captainId, true);
  return Response.json({ ok: true, capture, stats });
}
