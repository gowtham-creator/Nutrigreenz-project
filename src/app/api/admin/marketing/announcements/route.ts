/**
 * GET  /api/admin/marketing/announcements — list every evergreen marquee line.
 * POST /api/admin/marketing/announcements — create an announcement line.
 *
 * Super-admin only (see ../guard), mirroring the coupon / promotion admin
 * surfaces. `text` is required; `sort` orders the lines in the bar (ascending)
 * and `active` is the show/hide switch. Every create is written to the admin
 * activity trail and busts the storefront cache so the bar updates fast.
 */
import { requireSuperAdmin, superAdminEmail } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import {
  listAnnouncements,
  createAnnouncement,
  type AnnouncementInput,
} from "@/lib/announcements";
import { plainText, TEXT_LIMITS } from "@/lib/sanitize-text";

/**
 * A cleaned, length-capped non-empty string, else undefined.
 *
 * An announcement is ONE row of the scrolling top marquee, which has no second
 * line to spill onto. The previous helper only trimmed, so the ceiling that
 * matters most on this surface was the one that was missing.
 */
function str(v: unknown, max: number = TEXT_LIMITS.announcement): string | undefined {
  const s = plainText(v, max);
  return s ? s : undefined;
}

/** A finite, NON-NEGATIVE number, else undefined (blank / null / negative /
 *  non-numeric drop out). Ordering keys below zero let a tampered request jump
 *  a row above everything an operator arranged — see sanitize-text.ts. */
function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** GET — list all announcements, display order. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const announcements = await listAnnouncements();
  return Response.json({ ok: true, announcements });
}

/** POST — create an announcement line. Super-admin only. */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const text = str(body.text);
  if (!text) return Response.json({ ok: false, error: "text-required" }, { status: 400 });

  const input: AnnouncementInput = { text };
  if (typeof body.active === "boolean") input.active = body.active;
  const sort = num(body.sort);
  if (sort !== undefined) input.sort = sort;

  try {
    const announcement = await createAnnouncement(input);
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "announcement.create",
      target: announcement.id,
      meta: {
        text: announcement.text,
        active: announcement.active,
        sort: announcement.sort,
      },
    });
    // No revalidatePath: the storefront bar reads these via the client-fetched
    // /api/announcements (short-cached), so a whole-site revalidation would be
    // pointless here AND slow (it churns every route, incl. this admin page).
    return Response.json({ ok: true, announcement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
