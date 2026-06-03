import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_ROLE_COOKIE,
} from "@/lib/admin-auth";

/**
 * POST /api/admin/logout
 *
 * Clears the admin session by expiring all three cookies (maxAge 0): the
 * httpOnly gate (`ng_admin`) plus the readable `ng_admin_email` and
 * `ng_admin_role` cookies. The httpOnly gate cookie can only be cleared
 * server-side, which is why this lives in a route handler rather than client JS.
 */
export async function POST(): Promise<Response> {
  const secure = process.env.NODE_ENV === "production";
  const c = await cookies();

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

  return Response.json({ ok: true });
}
