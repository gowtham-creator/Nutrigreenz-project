import { requireSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getLoyaltyConfig, updateLoyaltyConfig, type LoyaltyConfigPatch } from "@/lib/rewards";

/** GET — the singleton loyalty programme config. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const config = await getLoyaltyConfig();
  return Response.json({ ok: true, config });
}

function num(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** PUT — update the singleton loyalty config. Super-admin only. */
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

  const patch: LoyaltyConfigPatch = {};
  const earn = num(body.earnPointsPerRupee);
  if (earn !== undefined) patch.earnPointsPerRupee = earn;
  const redeem = num(body.redeemPointsPerRupee);
  if (redeem !== undefined) patch.redeemPointsPerRupee = redeem;
  const min = num(body.minRedeemPoints);
  if (min !== undefined) patch.minRedeemPoints = min;
  const max = num(body.maxRedeemPercent);
  if (max !== undefined) patch.maxRedeemPercent = max;
  const expiry = num(body.expiryMonths);
  if (expiry !== undefined) patch.expiryMonths = expiry;
  if (typeof body.earnEnabled === "boolean") patch.earnEnabled = body.earnEnabled;

  try {
    const config = await updateLoyaltyConfig(patch);
    return Response.json({ ok: true, config });
  } catch (err) {
    const message = err instanceof Error ? err.message : "save-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
