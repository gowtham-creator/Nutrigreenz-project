/**
 * Farms collection API.
 *   GET  — list all farms (admin, DB truth, no static fallback).
 *   POST — create a farm (super-admin only, mirroring category creation).
 */
import { isSignedInAdmin, isSuperAdmin } from "./guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listFarms, upsertFarm } from "@/lib/content";
import { farmDraftFromBody } from "@/lib/content-input";
import { InputTooLongError } from "@/lib/sanitize-text";
import { requireApiPermission } from "@/lib/admin-api-guard";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("farms");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, farms: [] });
  const farms = await listFarms(false);
  return Response.json({ ok: true, farms });
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("farms");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  /* An over-length field is now a 400 naming the field, not a silent trim.
     See sanitize-text.ts: truncating returned 200 and told the operator their
     work had saved while cutting it to fit. */
  let draft;
  try {
    draft = farmDraftFromBody(body);
  } catch (err) {
    if (err instanceof InputTooLongError) {
      return Response.json({ ok: false, field: err.field, error: err.message }, { status: 400 });
    }
    throw err;
  }
  if (!draft.name) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  try {
    const farm = await upsertFarm(draft);
    return Response.json({ ok: true, farm });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
