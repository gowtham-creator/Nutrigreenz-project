import { requireSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  getCommerceRules,
  updateCommerceRules,
  type CommerceRulesPatch,
  type ShippingSlab,
  type ShippingType,
  type TaxMode,
} from "@/lib/commerce-rules";

/** GET — the singleton commerce config. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const rules = await getCommerceRules();
  return Response.json({ ok: true, rules });
}

const SHIPPING_TYPES: readonly ShippingType[] = ["flat", "slab", "zero"];
const TAX_MODES: readonly TaxMode[] = ["inclusive", "exclusive"];

/** Coerce arbitrary JSON into a list of numeric shipping slabs. */
function parseSlabs(raw: unknown): ShippingSlab[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: ShippingSlab[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const upto = Number(r.uptoPaise);
      const fee = Number(r.feePaise);
      if (Number.isFinite(upto) && Number.isFinite(fee)) {
        out.push({ uptoPaise: Math.max(0, Math.round(upto)), feePaise: Math.max(0, Math.round(fee)) });
      }
    }
  }
  return out;
}

function num(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** PUT — update the singleton commerce config. Super-admin only. */
export async function PUT(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const patch: CommerceRulesPatch = {};
  const minOrder = num(body.minOrderPaise);
  if (minOrder !== undefined) patch.minOrderPaise = minOrder;
  const freeDelivery = num(body.freeDeliveryThresholdPaise);
  if (freeDelivery !== undefined) patch.freeDeliveryThresholdPaise = freeDelivery;
  const shippingFlat = num(body.shippingFlatPaise);
  if (shippingFlat !== undefined) patch.shippingFlatPaise = shippingFlat;
  const taxRate = num(body.taxRateBps);
  if (taxRate !== undefined) patch.taxRateBps = taxRate;

  if (typeof body.shippingType === "string" && SHIPPING_TYPES.includes(body.shippingType as ShippingType)) {
    patch.shippingType = body.shippingType as ShippingType;
  }
  if (typeof body.taxMode === "string" && TAX_MODES.includes(body.taxMode as TaxMode)) {
    patch.taxMode = body.taxMode as TaxMode;
  }
  const slabs = parseSlabs(body.shippingSlabs);
  if (slabs !== undefined) patch.shippingSlabs = slabs;
  if (typeof body.currency === "string" && body.currency.trim()) {
    patch.currency = body.currency;
  }

  try {
    const rules = await updateCommerceRules(patch);
    return Response.json({ ok: true, rules });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
