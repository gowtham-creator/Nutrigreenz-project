import { cookies } from "next/headers";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  captainPhoneExists,
  captainStats,
  deleteCaptain,
  getCaptainById,
  listCapturesForCaptain,
  listSettlementsForCaptain,
  normalizeMobile10,
  updateCaptain,
  type CaptainUpdateInput,
} from "@/lib/captains";
import { withLengthValidation } from "@/lib/input-validation-guard";

/**
 * Admin single-captain surface.
 *
 *   GET    /api/admin/captains/[id] → the captain + recent captures + settlements
 *                                     + today's paise figures (drill-in).
 *   PATCH  /api/admin/captains/[id] → edit / activate / deactivate.
 *   DELETE /api/admin/captains/[id] → remove (cascades captures/settlements/pickups).
 *
 * Gated by the signed `ng_admin` session + `requireApiPermission("captains")`.
 * Phone uniqueness (excluding this row) + commission 0..100 are enforced on edit.
 */

async function adminSession() {
  const c = await cookies();
  return verifyToken(c.get(ADMIN_COOKIE)?.value);
}

function sanitizeCommunities(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const v of input) {
    const s = String(v ?? "").trim();
    if (s) out.add(s);
  }
  return [...out];
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/captains/[id]">,
): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!(await adminSession())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const captain = await getCaptainById(id);
  if (!captain) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  const [captures, settlements, todayStats] = await Promise.all([
    listCapturesForCaptain(id, false, 100),
    listSettlementsForCaptain(id),
    captainStats(id, true),
  ]);
  return Response.json({ ok: true, captain, captures, settlements, todayStats });
}

async function PATCHHandler(
  request: Request,
  ctx: RouteContext<"/api/admin/captains/[id]">,
): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!(await adminSession())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const existing = await getCaptainById(id);
  if (!existing) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const patch: CaptainUpdateInput = {};
  if (body.name !== undefined) {
    const name = strictText(body.name, TEXT_LIMITS.name, "Name");
    if (!name) return Response.json({ ok: false, error: "name_required" }, { status: 400 });
    patch.name = name;
  }
  if (body.phone !== undefined) {
    const phone = normalizeMobile10(String(body.phone));
    if (!phone) return Response.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    if (await captainPhoneExists(phone, id)) {
      return Response.json({ ok: false, error: "phone_taken" }, { status: 409 });
    }
    patch.phone = phone;
  }
  if (body.area !== undefined) patch.area = body.area != null ? strictText(body.area, TEXT_LIMITS.area, "Area") : null;
  if (body.stall !== undefined) patch.stall = body.stall != null ? String(body.stall).trim() : null;
  if (body.communities !== undefined) patch.communities = sanitizeCommunities(body.communities);
  if (body.commissionPercent !== undefined) {
    const pct = Number(body.commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return Response.json({ ok: false, error: "invalid_commission" }, { status: 400 });
    }
    patch.commissionPercent = pct;
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);

  const captain = await updateCaptain(id, patch);
  if (!captain) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  return Response.json({ ok: true, captain });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/captains/[id]">,
): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!(await adminSession())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const existing = await getCaptainById(id);
  if (!existing) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  await deleteCaptain(id);
  return Response.json({ ok: true });
}


export const PATCH = withLengthValidation(PATCHHandler);
