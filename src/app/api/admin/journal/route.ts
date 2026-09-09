/**
 * Journal collection API.
 *   GET  — list all articles (admin, DB truth, no static fallback).
 *   POST — create an article (super-admin only, mirroring category creation).
 */
import { isSignedInAdmin, isSuperAdmin } from "./guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listJournals, upsertJournal } from "@/lib/content";
import { journalDraftFromBody } from "@/lib/content-input";
import { InputTooLongError } from "@/lib/sanitize-text";
import { requireApiPermission } from "@/lib/admin-api-guard";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("journal");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, journals: [] });
  const journals = await listJournals(false);
  return Response.json({ ok: true, journals });
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("journal");
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
     article had saved while cutting it at 120 characters. */
  let draft;
  try {
    draft = journalDraftFromBody(body);
  } catch (err) {
    if (err instanceof InputTooLongError) {
      return Response.json({ ok: false, field: err.field, error: err.message }, { status: 400 });
    }
    throw err;
  }
  if (!draft.title) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  try {
    const journal = await upsertJournal(draft);
    return Response.json({ ok: true, journal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
