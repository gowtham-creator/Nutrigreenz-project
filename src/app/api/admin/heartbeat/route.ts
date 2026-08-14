import { cookies } from "next/headers";
import { verifyToken } from "@/lib/admin-session";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

/**
 * POST /api/admin/heartbeat — report whether the session is still valid.
 *
 * ── This no longer extends anything ───────────────────────────────────────
 *
 * It used to mint a fresh token on every ping, which slid the deadline forward
 * for as long as somebody kept moving a mouse — an idle timeout. The portal now
 * runs a FIXED session: the deadline is set once at sign-in and nothing an
 * operator does moves it, so a stolen laptop or an unattended screen has a hard
 * ceiling rather than one that renews itself.
 *
 * What is left is a liveness check. It answers 401 once the signed session has
 * expired or been revoked, which lets an open tab discover a "sign out
 * everywhere" from another device instead of sitting on a dead session until
 * the next navigation.
 */
export async function POST(): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  const session = await verifyToken(token);
  if (!session || !token) return Response.json({ ok: false }, { status: 401 });

  // Deliberately re-issues nothing: the deadline is fixed at sign-in.
  return Response.json({ ok: true });
}
