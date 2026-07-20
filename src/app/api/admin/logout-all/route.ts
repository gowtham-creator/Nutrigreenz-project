import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
} from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { bumpAdminTokenVersion } from "@/lib/admins";
import { logActivity } from "@/lib/activity-log";

// Bumps the persisted revocation counter via the service-role client (Node only).
export const runtime = "nodejs";

/**
 * POST /api/admin/logout-all
 *
 * "Log out everywhere" for the signed-in admin. Bumps their persisted
 * `admins.token_version`, which the Node session guards compare against every
 * token's embedded version — so EVERY session minted before this call (this
 * browser and any other device) is rejected on its next request. Then clears the
 * three session cookies here, exactly like `/api/admin/logout`.
 *
 * Best-effort for env-only operators: they have no `admins` row to bump, so this
 * still clears the local cookies but cannot invalidate other devices (there is
 * no persisted counter for them). Lives under `/api/...` so the `/admin/...`
 * proxy matcher does not block it.
 */
export async function POST(): Promise<Response> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  if (!session) return Response.json({ ok: false }, { status: 401 });

  // Revoke every existing token for this admin.
  await bumpAdminTokenVersion(session.email);

  const secure = process.env.NODE_ENV === "production";
  for (const name of [ADMIN_COOKIE, ADMIN_EMAIL_COOKIE, ADMIN_ROLE_COOKIE]) {
    c.set({
      name,
      value: "",
      httpOnly: name === ADMIN_COOKIE,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  await logActivity({
    actorEmail: session.email,
    actorRole: session.role,
    action: "admin.logout_all",
  });

  return Response.json({ ok: true });
}
