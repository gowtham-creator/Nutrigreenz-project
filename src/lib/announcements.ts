/**
 * Announcements data-access (Supabase `public.announcements`).
 *
 * An announcement is an evergreen line for the storefront top marquee — the
 * always-on shipping / new-arrival / membership notes that scroll AFTER any LIVE
 * promotion line. This module is the SINGLE source of truth for those lines, so
 * an operator can edit them from the Marketing desk without a deploy.
 *
 * Service-role only — import from Node route handlers / Server Components, never
 * client/Edge (RLS on `public.announcements` has no policies; only the
 * service-role client can touch it). The public storefront reaches the active
 * lines through the unauthenticated /api/announcements route.
 *
 * Resilience: reads NEVER throw. When Supabase is unconfigured or a query fails,
 * the resolvers return an empty list, so the marquee simply shows the live promo
 * lines (or nothing) instead of breaking the page.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

/* ── record + input shapes ────────────────────────────────────────────────── */

/** A persisted evergreen announcement line, camelCased. */
export interface AnnouncementRecord {
  id: string;
  text: string;
  active: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** The fields the admin API accepts when creating an announcement. */
export interface AnnouncementInput {
  text: string;
  active?: boolean;
  sort?: number;
}

/** A partial edit of an announcement line. */
export interface AnnouncementPatch {
  text?: string;
  active?: boolean;
  sort?: number;
}

/* ── row shape + mapper ───────────────────────────────────────────────────── */

interface AnnouncementRow {
  id: string;
  text: string;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

const ANNOUNCEMENT_COLS = "id, text, active, sort, created_at, updated_at";

function toAnnouncement(r: AnnouncementRow): AnnouncementRecord {
  return {
    id: r.id,
    text: r.text,
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* ── reads (never throw) ──────────────────────────────────────────────────── */

/**
 * The evergreen lines that are LIVE, in display order (sort asc then oldest).
 * Powers the public marquee. Returns [] when unconfigured or on any error.
 */
export async function listActiveAnnouncements(): Promise<AnnouncementRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("announcements")
      .select(ANNOUNCEMENT_COLS)
      .eq("active", true)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    return ((data as AnnouncementRow[] | null) ?? []).map(toAnnouncement);
  } catch {
    return [];
  }
}

/**
 * Every announcement, in display order (sort asc then oldest) — for the admin
 * table. Returns [] when unconfigured or on any error.
 */
export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("announcements")
      .select(ANNOUNCEMENT_COLS)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    return ((data as AnnouncementRow[] | null) ?? []).map(toAnnouncement);
  } catch {
    return [];
  }
}

/* ── admin CRUD ───────────────────────────────────────────────────────────── */

/**
 * Create an announcement. Validates non-empty text and returns the persisted
 * row. Throws on a DB error so the route can answer 400 with the reason.
 */
export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<AnnouncementRecord> {
  const text = input.text.trim();
  if (!text) throw new Error("text-required");

  const row: Record<string, unknown> = {
    text,
    active: input.active ?? true,
    sort: Math.round(input.sort ?? 0),
  };

  const { data, error } = await supabaseAdmin()
    .from("announcements")
    .insert(row)
    .select(ANNOUNCEMENT_COLS)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "create-failed");
  }
  return toAnnouncement(data as AnnouncementRow);
}

/**
 * Edit an announcement line. Returns the fresh row, or null when no announcement
 * has that id. Throws on validation / DB errors.
 */
export async function updateAnnouncement(
  id: string,
  patch: AnnouncementPatch,
): Promise<AnnouncementRecord | null> {
  const update: Record<string, unknown> = {};
  if (patch.text !== undefined) {
    const text = patch.text.trim();
    if (!text) throw new Error("text-required");
    update.text = text;
  }
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.sort !== undefined) update.sort = Math.round(patch.sort);

  if (Object.keys(update).length === 0) {
    // Nothing to change — return the current row so the caller can 200/404.
    const { data } = await supabaseAdmin()
      .from("announcements")
      .select(ANNOUNCEMENT_COLS)
      .eq("id", id)
      .maybeSingle();
    return data ? toAnnouncement(data as AnnouncementRow) : null;
  }

  const { data, error } = await supabaseAdmin()
    .from("announcements")
    .update(update)
    .eq("id", id)
    .select(ANNOUNCEMENT_COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAnnouncement(data as AnnouncementRow) : null;
}

/** Whether a delete found and removed an announcement. */
export type AnnouncementRemoval = "deleted" | "not-found";

/**
 * Delete an announcement outright. Announcements carry no history to keep, so a
 * hard delete is safe. Returns "not-found" when no row matched the id.
 */
export async function deleteAnnouncement(id: string): Promise<AnnouncementRemoval> {
  const { data, error } = await supabaseAdmin()
    .from("announcements")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? "deleted" : "not-found";
}

/** Whether the announcements backend is usable (Supabase configured). */
export function isAnnouncementsBackendReady(): boolean {
  return isSupabaseConfigured;
}
