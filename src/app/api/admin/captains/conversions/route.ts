import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { logActivity } from "@/lib/activity-log";
import { conversionReport, registerOfflineCustomer } from "@/lib/captain-conversions";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Captain conversions.
 *
 *   GET  /api/admin/captains/conversions?captainId= → which offline customers
 *        went on to buy online, for one captain or everyone.
 *   POST /api/admin/captains/conversions { captainId, mobile, name } → register
 *        an offline customer against the captain who introduced them.
 *
 * Gated like the rest of the captain admin: `requireApiPermission("captains")`
 * plus a signed admin session.
 */
async function session() {
  return verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  if (!(await session())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });

  const captainId = new URL(request.url).searchParams.get("captainId")?.trim() || undefined;
  try {
    const report = await conversionReport(captainId);
    return Response.json({ ok: true, report }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[captains] conversions failed:", err);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("captains");
  if (denied) return denied;
  const admin = await session();
  if (!admin) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  try {
    const result = await registerOfflineCustomer({
      captainId: text(body.captainId, 64),
      mobile: text(body.mobile, 20),
      name: text(body.name, 120) || null,
      byEmail: admin.email,
    });
    if (!result.ok) {
      return Response.json(result, {
        status: result.error === "already-registered" ? 409 : result.error === "setup-pending" ? 503 : 400,
      });
    }
    await logActivity({
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "captain.customer_registered",
      target: text(body.captainId, 64),
      meta: { name: text(body.name, 120) || null },
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[captains] register offline customer failed:", err);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
