/**
 * Admin system-activity trail (Supabase-backed).
 *
 * `admin_activity` records who did what across the operator portal — successful
 * sign-ins and admin-user mutations. Writes are best-effort and MUST never throw
 * into the caller: a logging hiccup can't be allowed to fail a real sign-in or
 * mutation, so every write is wrapped in try/catch and silently swallowed.
 *
 * Service-role only (RLS has no policies; the service key bypasses it) — import
 * from Node route handlers, never from client components or the Edge proxy.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/** A single recorded activity event, as returned to the UI feed. */
export interface ActivityEntry {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface LogActivityInput {
  actorEmail: string;
  actorRole: string;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Record an activity event. Best-effort: returns without throwing on any error
 * (unconfigured DB, network hiccup, bad row) so callers can fire-and-forget.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabaseAdmin()
      .from("admin_activity")
      .insert({
        actor_email: input.actorEmail,
        actor_role: input.actorRole,
        action: input.action,
        target: input.target ?? null,
        meta: input.meta ?? null,
      });
  } catch {
    /* best-effort — never surface a logging failure to the caller */
  }
}

/** Raw `admin_activity` row shape (snake_case), as selected from Postgres. */
interface ActivityRow {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string | null;
  target: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const ACTIVITY_COLS = "id, actor_email, actor_role, action, target, meta, created_at";

/** Map a raw row to the UI-facing {@link ActivityEntry}. */
function toEntry(row: ActivityRow): ActivityEntry {
  return {
    id: String(row.id),
    actorEmail: row.actor_email ?? null,
    actorRole: row.actor_role ?? null,
    action: String(row.action ?? ""),
    target: row.target ?? null,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/**
 * Read the most recent activity events, newest first. Returns an empty list on
 * any error so the feed degrades gracefully instead of breaking the page.
 */
export async function listActivity(limit = 50): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return [];
  const capped = Math.min(Math.max(1, limit), 200);
  try {
    const { data } = await supabaseAdmin()
      .from("admin_activity")
      .select(ACTIVITY_COLS)
      .order("created_at", { ascending: false })
      .limit(capped);
    return ((data as ActivityRow[] | null) ?? []).map(toEntry);
  } catch {
    return [];
  }
}

/**
 * The most recent activity events for ONE actor — their own personal trail —
 * newest first. Powers each operator's "Recent activity" feed on `/admin/profile`.
 * The `actorEmail` is the signed-in session email, which login writes verbatim
 * as `actor_email`, so an exact match is correct. Returns [] on any error.
 */
export async function listActivityForActor(
  actorEmail: string,
  limit = 8,
): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return [];
  const capped = Math.min(Math.max(1, limit), 50);
  try {
    const { data } = await supabaseAdmin()
      .from("admin_activity")
      .select(ACTIVITY_COLS)
      .eq("actor_email", actorEmail)
      .order("created_at", { ascending: false })
      .limit(capped);
    return ((data as ActivityRow[] | null) ?? []).map(toEntry);
  } catch {
    return [];
  }
}
