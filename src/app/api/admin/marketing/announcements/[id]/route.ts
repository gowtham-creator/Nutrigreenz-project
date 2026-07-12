/**
 * PATCH  /api/admin/marketing/announcements/[id] — edit a marquee line.
 * DELETE /api/admin/marketing/announcements/[id] — remove a marquee line.
 *
 * Super-admin only (see ../../guard). PATCH edits the text, sort or active flag;
 * an announcement carries no history (unlike a coupon), so DELETE hard-removes
 * it. Every mutation is logged and busts the storefront cache so the bar updates
 * fast.
 */
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, superAdminEmail } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import {
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementPatch,
} from "@/lib/announcements";

type Ctx = { params: Promise<{ id: string }> };

/** A trimmed non-empty string, else undefined. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** A finite number, else undefined (blank / null / non-numeric drop out). */
function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** PATCH — edit a line's text / sort / active flag. Super-admin only. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
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

  const patch: AnnouncementPatch = {};
  const text = str(body.text);
  if (text !== undefined) patch.text = text;
  if (typeof body.active === "boolean") patch.active = body.active;
  const sort = num(body.sort);
  if (sort !== undefined) patch.sort = sort;

  try {
    const announcement = await updateAnnouncement(id, patch);
    if (!announcement) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "announcement.update",
      target: announcement.id,
      meta: {
        text: announcement.text,
        active: announcement.active,
        sort: announcement.sort,
      },
    });
    // Editing / toggling a line changes the top bar — bust the ISR cache so the
    // change is visible within a second or two.
    revalidatePath("/", "layout");
    return Response.json({ ok: true, announcement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a line. Super-admin only. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

  try {
    const removal = await deleteAnnouncement(id);
    if (removal === "not-found") {
      return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "announcement.delete",
      target: id,
      meta: { removal },
    });
    // A removed line must stop scrolling in the bar immediately.
    revalidatePath("/", "layout");
    return Response.json({ ok: true, removal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "delete-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
