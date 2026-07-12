import { cookies } from "next/headers";
import { verifyToken, ADMIN_SESSION_TTL_SECONDS } from "@/lib/admin-session";
import { ADMIN_COOKIE, ADMIN_EMAIL_COOKIE, ADMIN_ROLE_COOKIE } from "@/lib/admin-auth";

/**
 * POST /api/admin/heartbeat — slide the admin idle session.
 *
 * The client `IdleTimeout` pings this (throttled) while the operator is active.
 * When the signed `ng_admin` session is still valid we re-issue all three admin
 * cookies with a fresh maxAge, so an active operator never lapses across the idle
 * window. After the window with no ping the cookies expire on their own and the
 * proxy sends the next admin request to the login screen. A missing/expired
 * session answers 401 (no cookies re-issued) so it can't resurrect a dead one.
 */
export async function POST(): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  const session = await verifyToken(token);
  if (!session || !token) return Response.json({ ok: false }, { status: 401 });

  const secure = process.env.NODE_ENV === "production";
  const base = { secure, sameSite: "lax" as const, path: "/", maxAge: ADMIN_SESSION_TTL_SECONDS };

  // Re-issue the signed session (unchanged value) + the readable UI cookies from
  // the tamper-proof token's own email/role, all with a fresh window.
  jar.set({ name: ADMIN_COOKIE, value: token, httpOnly: true, ...base });
  jar.set({ name: ADMIN_EMAIL_COOKIE, value: session.email, httpOnly: false, ...base });
  jar.set({ name: ADMIN_ROLE_COOKIE, value: session.role, httpOnly: false, ...base });

  return Response.json({ ok: true });
}
