import { isSignedInAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { listProductAudit, type AuditKind } from "@/lib/product-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: readonly AuditKind[] = ["all", "price", "stock", "details", "variants", "added-removed"];

/**
 * GET /api/admin/inventory/history — the product audit log, newest first.
 *
 *   ?productId=  one product's history (kept after the product is deleted)
 *   ?kind=       all | price | stock | details | variants | added-removed
 *   ?since=      ISO instant, the start of a time window
 *   ?before=     ISO instant, to page back through older entries
 *
 * Open to anyone who can use the catalog, like the catalog itself.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });

  const url = new URL(request.url);
  const iso = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  const kindRaw = url.searchParams.get("kind") ?? "all";
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as AuditKind) : "all";
  const productId = url.searchParams.get("productId")?.trim() || null;
  if (productId && !/^[0-9a-f-]{36}$/i.test(productId)) {
    return Response.json({ ok: false, error: "invalid-product" }, { status: 400 });
  }

  try {
    const entries = await listProductAudit({
      productId,
      kind,
      sinceIso: iso(url.searchParams.get("since")),
      beforeIso: iso(url.searchParams.get("before")),
      limit: 100,
    });
    return Response.json({ ok: true, entries }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "setup-pending") return Response.json({ ok: false, error: "setup-pending" }, { status: 503 });
    console.error("[inventory/history] read failed:", err);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
