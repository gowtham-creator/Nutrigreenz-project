import { cookies } from "next/headers";
import { verifyToken, createToken, adminCookieOptions } from "@/lib/admin-session";
import { ADMIN_COOKIE, ADMIN_EMAIL_COOKIE, ADMIN_ROLE_COOKIE } from "@/lib/admin-auth";

/**
 * POST /api/admin/heartbeat — slide the admin idle session.
 *
 * The client `IdleTimeout` pings this (throttled) while the operator is active.
 * A missing or expired session answers 401 and re-issues nothing, so this can
 * never resurrect a dead one.
 *
 * ── This now mints a NEW token, and has to ────────────────────────────────
 *
 * It used to re-issue the SAME token value with a fresh cookie `maxAge`. But
 * the expiry that `verifyToken` actually enforces is baked into the token at
 * login, so refreshing the cookie slid nothing: the session died 35 minutes
 * after sign-in however active the operator was, and the heartbeat only made it
 * look otherwise. Minting a fresh token moves the expiry the server checks,
 * which is what "sliding" was always supposed to mean.
 *
 * It also has to work now, because the cookies no longer carry a maxAge —
 * see `adminCookieOptions`. The signed expiry is the only thing keeping the
 * window, so it is the thing that must be refreshed.
 *
 * The revocation counter is carried across unchanged, so "sign out everywhere"
 * still kills a session that is being actively heartbeaten.
 */
export async function POST(): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  const session = await verifyToken(token);
  if (!session || !token) return Response.json({ ok: false }, { status: 401 });

  let fresh: string;
  try {
    fresh = await createToken(session.email, session.role, session.tokenVersion);
  } catch {
    // Secret unconfigured — fail closed rather than extending on a stale token.
    return Response.json({ ok: false }, { status: 401 });
  }

  const base = adminCookieOptions(process.env.NODE_ENV === "production");

  jar.set({ name: ADMIN_COOKIE, value: fresh, httpOnly: true, ...base });
  jar.set({ name: ADMIN_EMAIL_COOKIE, value: session.email, httpOnly: false, ...base });
  jar.set({ name: ADMIN_ROLE_COOKIE, value: session.role, httpOnly: false, ...base });

  return Response.json({ ok: true });
}
