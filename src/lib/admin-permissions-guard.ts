/**
 * Server-side per-feature access guard for admin PAGES (the layer above the
 * Edge proxy and the nav filter — defense in depth).
 *
 * Service-role only: it reads the signed httpOnly `ng_admin` session and the
 * `admins.permissions` column, so it must run in the Node runtime (never Edge /
 * client). A route segment's `layout.tsx` calls {@link requirePermission} with
 * that section's key; a plain admin who lacks the grant is redirected to the
 * overview (`/admin`) BEFORE the page renders. `redirect()` throws, so control
 * never returns to the caller on denial.
 *
 * Super-admins always pass (they hold every permission), and the session is
 * resolved server-side from the tamper-proof token — never a client value — so
 * a granted VIEW permission can never be forged into one the operator lacks.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { getAdminByEmail, getAdminTokenVersion } from "@/lib/admins";
import {
  resolvePermissions,
  type PermissionKey,
} from "@/lib/admin-permissions";

/**
 * The signed-in admin's effective permission set (or null when unauthenticated
 * OR the token was revoked — its embedded `token_version` is behind the live
 * `admins.token_version`). Skips the permission DB read for super-admins, who
 * always hold every permission.
 */
export async function currentAdminPermissions(): Promise<Set<PermissionKey> | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  if (!session) return null;
  if (session.tokenVersion !== (await getAdminTokenVersion(session.email))) return null;
  if (session.role === "superadmin") return resolvePermissions("superadmin", null);
  const record = await getAdminByEmail(session.email); // never throws
  return resolvePermissions(session.role, record?.permissions ?? null);
}

/**
 * Gate a protected admin section. When the caller lacks `key` it redirects to
 * the overview (`/admin`, which is always granted so this can never loop); when
 * there is no session at all it redirects to the login screen. Returns normally
 * ONLY when access is allowed.
 */
export async function requirePermission(key: PermissionKey): Promise<void> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  // Revoked token (version bumped by a password reset / "log out everywhere")
  // is treated as no session — bounce to login.
  if (session.tokenVersion !== (await getAdminTokenVersion(session.email))) redirect("/admin/login");
  // Super-admins always have every section — no DB read needed.
  if (session.role === "superadmin") return;
  const record = await getAdminByEmail(session.email); // never throws
  const perms = resolvePermissions(session.role, record?.permissions ?? null);
  if (!perms.has(key)) redirect("/admin");
}
