import { requireSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import {
  getReferralConfig,
  updateReferralConfig,
  type ReferralConfigPatch,
} from "@/lib/referral-config";

/** GET — the singleton referral programme config. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const config = await getReferralConfig();
  return Response.json({ ok: true, config });
}

function num(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** PUT — update the singleton referral config. Super-admin only. */
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

  const patch: ReferralConfigPatch = {};
  const referrer = num(body.referrerPoints);
  if (referrer !== undefined) patch.referrerPoints = referrer;
  const refereeDiscount = num(body.refereeDiscountPaise);
  if (refereeDiscount !== undefined) patch.refereeDiscountPaise = refereeDiscount;
  const minOrder = num(body.minQualifyingOrderPaise);
  if (minOrder !== undefined) patch.minQualifyingOrderPaise = minOrder;
  const perMonth = num(body.maxPerMonth);
  if (perMonth !== undefined) patch.maxPerMonth = perMonth;
  const expiry = num(body.expiryDays);
  if (expiry !== undefined) patch.expiryDays = expiry;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.blockSameDevice === "boolean") patch.blockSameDevice = body.blockSameDevice;
  if (typeof body.dedupeMobile === "boolean") patch.dedupeMobile = body.dedupeMobile;
  if (typeof body.blockAddressCluster === "boolean") {
    patch.blockAddressCluster = body.blockAddressCluster;
  }

  try {
    const config = await updateReferralConfig(patch);
    return Response.json({ ok: true, config });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
