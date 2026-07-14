/**
 * Journal collection API.
 *   GET  — list all articles (admin, DB truth, no static fallback).
 *   POST — create an article (super-admin only, mirroring category creation).
 */
import { isSignedInAdmin, isSuperAdmin } from "./guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listJournals, upsertJournal } from "@/lib/content";
import { journalDraftFromBody } from "@/lib/content-input";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, journals: [] });
  const journals = await listJournals(false);
  return Response.json({ ok: true, journals });
}

export async function POST(request: Request): Promise<Response> {
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

  const draft = journalDraftFromBody(body);
  if (!draft.title) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  try {
    const journal = await upsertJournal(draft);
    return Response.json({ ok: true, journal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
