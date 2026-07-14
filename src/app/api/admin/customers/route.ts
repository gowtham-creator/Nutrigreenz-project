import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { listCustomers } from "@/lib/admin-customers";

/**
 * GET /api/admin/customers — DEDUPED canonical customer directory.
 *
 * Admin/superadmin-gated (mirrors the cookie + `verifyToken` pattern used by
 * `/api/admin/admins` and `/api/admin/inventory`). Any signed-in admin OR
 * superadmin may read this — it is not super-admin-only.
 *
 * Query params: `search`, `limit`, `offset`. Returns one row per real person
 * (tombstones excluded), with aggregated providers + identity/address counts.
 * When Supabase is unconfigured the response is an empty, well-formed page so
 * the UI shows its empty state rather than an error.
 */

/** True when a valid signed-in admin/superadmin session is present. */
async function isSignedInAdmin(): Promise<boolean> {
  const c = await cookies();
  const session = await verifyToken(c.get(ADMIN_COOKIE)?.value);
  return Boolean(session);
}

export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("customers");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return Response.json({
      ok: true,
      customers: [],
      total: 0,
      identitiesTotal: 0,
      customersTotal: 0,
    });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get("limit"));
  const offsetRaw = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : undefined;

  const page = await listCustomers({ search, limit, offset });
  return Response.json({ ok: true, ...page });
}
