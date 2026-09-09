/**
 * Journal item API.
 *   PATCH  — update an article (super-admin only).
 *   DELETE — remove an article (super-admin only).
 */
import { isSignedInAdmin, isSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { upsertJournal, deleteJournal } from "@/lib/content";
import { journalDraftFromBody } from "@/lib/content-input";
import { InputTooLongError } from "@/lib/sanitize-text";
import { requireApiPermission } from "@/lib/admin-api-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("journal");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

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
    draft = journalDraftFromBody(body);
  } catch (err) {
    if (err instanceof InputTooLongError) {
      return Response.json({ ok: false, field: err.field, error: err.message }, { status: 400 });
    }
    throw err;
  }
  if (!draft.title) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  try {
    const journal = await upsertJournal({ ...draft, id });
    return Response.json({ ok: true, journal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("journal");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;
  await deleteJournal(id);
  return Response.json({ ok: true });
}
