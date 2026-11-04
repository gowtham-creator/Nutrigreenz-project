import { recordAdminAction } from "@/lib/admin-action-log";
import { requireSuperAdmin, superAdminEmail } from "../guard";
import { optOutMobile } from "@/lib/offline-campaigns";

export const runtime = "nodejs";

/**
 * POST /api/admin/marketing/offline-optouts { mobile } — stop messaging a
 * number. Offline customers can't unsubscribe online, so when someone asks a
 * captain or the store to stop, an operator records it here.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  let mobile = "";
  try {
    const body = (await request.json()) as { mobile?: unknown };
    mobile = typeof body.mobile === "string" ? body.mobile.slice(0, 20) : "";
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  try {
    const ok = await optOutMobile(mobile, await superAdminEmail());
    if (ok) await recordAdminAction("marketing.optout_added", mobile.replace(/\D/g, "").slice(-4).padStart(10, "•"));
    return ok
      ? Response.json({ ok: true })
      : Response.json({ ok: false, error: "invalid-mobile" }, { status: 400 });
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
