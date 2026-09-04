import { cookies } from "next/headers";
import { TEXT_LIMITS, plainText } from "@/lib/sanitize-text";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  captainPhoneExists,
  createCaptain,
  listCaptains,
  normalizeMobile10,
} from "@/lib/captains";

/**
 * Admin captain roster.
 *
 *   GET  /api/admin/captains → every captain + today's paise figures.
 *   POST /api/admin/captains → create a captain.
 *
 * Gated exactly like the other admin JSON APIs: the signed `ng_admin` session +
 * `requireApiPermission("captains")` (a super-admin always passes). Money in the
 * response is integer paise. Phone uniqueness + commission 0..100 are enforced.
 */

/** The signed-in admin's session (email needed for the `created_by` breadcrumb). */
async function adminSession() {
  const c = await cookies();
  return verifyToken(c.get(ADMIN_COOKIE)?.value);
}

/** Sanitise a client communities payload to a clean, de-duped string list. */
function sanitizeCommunities(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const v of input) {
    const s = String(v ?? "").trim();
    if (s) out.add(s);
  }
  return [...out];
}

export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!(await adminSession())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, captains: [] });
  }
  const captains = await listCaptains(true);
  return Response.json({ ok: true, captains });
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  const session = await adminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
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
  const phone = normalizeMobile10(String(body.phone ?? ""));
  const area = body.area != null ? plainText(body.area, TEXT_LIMITS.area) : null;
  const stall = body.stall != null ? plainText(body.stall, TEXT_LIMITS.label) : null;
  const communities = sanitizeCommunities(body.communities);
  const active = body.active === undefined ? true : Boolean(body.active);

  if (!name) return Response.json({ ok: false, error: "name_required" }, { status: 400 });
  if (!phone) return Response.json({ ok: false, error: "invalid_phone" }, { status: 400 });

  let commissionPercent = 0;
  if (body.commissionPercent !== undefined) {
    const pct = Number(body.commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return Response.json({ ok: false, error: "invalid_commission" }, { status: 400 });
    }
    commissionPercent = pct;
  }

  if (await captainPhoneExists(phone)) {
    return Response.json({ ok: false, error: "phone_taken" }, { status: 409 });
  }

  const captain = await createCaptain({
    name,
    phone,
    area,
    stall,
    communities,
    commissionPercent,
    active,
    createdBy: session.email,
  });
  return Response.json({ ok: true, captain }, { status: 201 });
}
