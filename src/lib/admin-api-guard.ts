/**
 * Server-side per-permission authorization for admin JSON APIs — the API-layer
 * counterpart to the per-page guard `requirePermission`
 * (src/lib/admin-permissions-guard.ts).
 *
 * The Edge proxy's matcher excludes `/api`, so every admin API route self-guards.
 * Historically those guards checked ROLE only (any signed-in admin OR super-admin),
 * so a plain admin whose SECTION grant was revoked was redirected away from the
 * PAGE yet could still call the matching JSON API directly (`GET /api/admin/customers`,
 * `/reports`, `/analytics`, …). That made the granular-permissions model
 * view-gating, not authorization. This module closes the gap.
 *
 * {@link requireApiPermission} resolves the caller's EFFECTIVE permission set from
 * the signed httpOnly `ng_admin` session + the `admins.permissions` column — never
 * a client-supplied value — and answers 403 when the section key is not held. A
 * super-admin always passes (they hold every permission); `overview` is always
 * granted, so no admin is ever locked out. Sensitive write surfaces that are
 * already super-admin-only (admin CRUD, config, marketing) keep their
 * `requireSuperAdmin` gate and do not use this helper.
 *
 * It returns a `Response` to short-circuit with, or `null` when access is allowed —
 * mirroring the `requireSuperAdmin` shape used across the config/marketing routes.
 *
 * Node runtime only: it reads the DB via {@link getAdminByEmail}. Never import it
 * into the Edge proxy or a client component.
 */
import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { getAdminByEmail } from "@/lib/admins";
import { resolvePermissions, type PermissionKey } from "@/lib/admin-permissions";

/**
 * The signed-in admin's effective permission set, or `null` when there is no
 * valid admin session. Super-admins hold every permission, so the DB read is
 * skipped for them (mirrors {@link currentAdminPermissions} in the page guard).
 */
export async function currentApiPermissions(): Promise<Set<PermissionKey> | null> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  if (!session) return null;
  if (session.role === "superadmin") return resolvePermissions("superadmin", null);
  const record = await getAdminByEmail(session.email); // never throws
  return resolvePermissions(session.role, record?.permissions ?? null);
}

/**
 * Gate an admin API route on a single permission `key`. Returns:
 *   · a 401 `Response` when there is no valid admin session,
 *   · a 403 `Response` when the caller is a plain admin who lacks `key`,
 *   · `null` when access is allowed (a super-admin, or an admin who holds `key`).
 *
 * Usage (identical in shape to `requireSuperAdmin`):
 *
 *   const denied = await requireApiPermission("catalog");
 *   if (denied) return denied;
 */
export async function requireApiPermission(
  key: PermissionKey,
): Promise<Response | null> {
  const perms = await currentApiPermissions();
  if (!perms) {
    return Response.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }
  if (!perms.has(key)) {
    return Response.json(
      { ok: false, error: "forbidden", permission: key },
      { status: 403 },
    );
  }
  return null;
}
