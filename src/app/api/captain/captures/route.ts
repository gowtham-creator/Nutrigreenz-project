import { TEXT_LIMITS, plainMultiline, plainText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  addCapture,
  captainStats,
  listCapturesForCaptain,
  normalizeMobile10,
  requireActiveCaptain,
} from "@/lib/captains";
import { allocationsForCaptain, type AllocatedItem } from "@/lib/captain-allocations";
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
 *
 * ALLOCATION: every line must be a product this captain is allocated, at the
 * allocated price. The line's SKU, title, unit and price are taken from the
 * allocation, not from the request — the request only says which variant and
 * how many. A price the client shows that no longer matches is refused with
 * `price_changed` rather than silently recorded at a different amount.
 */

const ZERO_STATS: CaptainStats = { count: 0, orders: 0, gmvPaise: 0, cashPaise: 0, upiPaise: 0 };

export async function GET(): Promise<Response> {
  const gate = await requireActiveCaptain();
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

type LineResult = CaptainCaptureItem | "invalid_items" | "not_allocated" | "price_changed";

/** Match a client cart line to this captain's allocation and build the paise line. */
function toPaiseItem(raw: RawItem, allocation: AllocatedItem[]): LineResult {
  const sku = String(raw.sku ?? "").trim();
  const variantId = typeof raw.variantId === "string" ? raw.variantId.trim() : "";
  const priceRupees = Number(raw.price);
  const qty = Math.round(Number(raw.qty));
  if (!variantId && !sku) return "invalid_items";
  if (!Number.isFinite(priceRupees) || priceRupees < 0 || priceRupees > 1_000_000) return "invalid_items";
  if (!Number.isFinite(qty) || qty < 1 || qty > 999) return "invalid_items";

  // Prefer the variant id; captures queued before it was sent fall back to SKU.
  const match = variantId
    ? allocation.find((a) => a.variantId === variantId)
    : allocation.find((a) => a.sku !== "" && a.sku === sku);
  if (!match) return "not_allocated";
  if (Math.round(priceRupees * 100) !== match.pricePaise) return "price_changed";

  return {
    variantId: match.variantId,
    productId: match.productId,
    sku: match.sku,
    title: match.title,
    unit: match.pack ? `${match.unit} · ${match.pack}` : match.unit,
    pricePaise: match.pricePaise,
    qty,
  };
}

/** Client idempotency key: the outbox temp id. Anything odd is ignored. */
function cleanClientRef(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{8,80}$/.test(value) ? value : null;
}

export async function POST(request: Request): Promise<Response> {
  const gate = await requireActiveCaptain();
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

  const name = plainText(body.name, TEXT_LIMITS.name);
  const mobile = normalizeMobile10(String(body.mobile ?? ""));
  const community = body.community != null ? plainText(body.community, TEXT_LIMITS.area) || null : null;
  const payModeRaw = String(body.payMode ?? "").toLowerCase();
  const notes = body.notes != null ? plainMultiline(body.notes, TEXT_LIMITS.notes) : null;
  const rawItems = Array.isArray(body.items) ? (body.items as RawItem[]) : [];

  if (!name) return Response.json({ ok: false, error: "name_required" }, { status: 400 });
  if (!mobile) return Response.json({ ok: false, error: "invalid_mobile" }, { status: 400 });
  if (payModeRaw !== "cash" && payModeRaw !== "upi") {
    return Response.json({ ok: false, error: "invalid_pay_mode" }, { status: 400 });
  }
  if (rawItems.length === 0 || rawItems.length > 100) {
    return Response.json({ ok: false, error: "invalid_items" }, { status: 400 });
  }

  const allocation = await allocationsForCaptain(gate.captainId);
  const items: CaptainCaptureItem[] = [];
  for (const raw of rawItems) {
    const item = toPaiseItem(raw ?? {}, allocation);
    if (item === "invalid_items") {
      return Response.json({ ok: false, error: item }, { status: 400 });
    }
    if (item === "not_allocated" || item === "price_changed") {
      return Response.json({ ok: false, error: item }, { status: 409 });
    }
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
    clientRef: cleanClientRef(body.clientRef),
  });
  const stats = await captainStats(gate.captainId, true);
  return Response.json({ ok: true, capture, stats });
}
