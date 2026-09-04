/**
 * PATCH  /api/admin/marketing/promotions/[id] — edit a promotion's terms.
 * DELETE /api/admin/marketing/promotions/[id] — remove a promotion.
 *
 * Super-admin only (see ../../guard). The slug is immutable once issued; PATCH
 * edits the campaign terms (banner, copy, percent, scope, window, active flag,
 * priority, auto-month). `bannerKey` is validated against the nine shipped keys
 * and `discountPercent` against 1..90. A promotion carries no redemption history
 * (unlike a coupon), so DELETE hard-removes it. Every mutation is logged.
 */
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, superAdminEmail } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import {
  updatePromotion,
  deletePromotion,
  isBannerKey,
  type PromotionPatch,
  type PromotionScope,
} from "@/lib/promotions";

type Ctx = { params: Promise<{ id: string }> };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** A finite, NON-NEGATIVE number, else undefined. Guards `priority` and
 *  `discountPercent`: a negative discount is a price INCREASE, and a negative
 *  priority jumps a promotion above every one an operator ordered. */
function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function nullableStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === "string" && !v.trim())) return null;
  return typeof v === "string" ? v.trim() : undefined;
}

function scope(v: unknown): PromotionScope | undefined {
  return v === "all" || v === "category" || v === "product" ? v : undefined;
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

/** PATCH — edit a promotion's terms (not its slug). Super-admin only. */
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

  // Reject an explicit but invalid banner key / percent up front with a clear code.
  if (body.bannerKey !== undefined && !isBannerKey(body.bannerKey)) {
    return Response.json({ ok: false, error: "invalid-banner-key" }, { status: 400 });
  }
  const percentIn = num(body.discountPercent);
  if (body.discountPercent !== undefined && (percentIn === undefined || percentIn < 1 || percentIn > 90)) {
    return Response.json({ ok: false, error: "invalid-discount-percent" }, { status: 400 });
  }

  const patch: PromotionPatch = {};
  const title = str(body.title);
  if (title !== undefined) patch.title = title;
  if (typeof body.bannerKey === "string") patch.bannerKey = body.bannerKey;
  const headline = str(body.headline);
  if (headline !== undefined) patch.headline = headline;
  const subcopy = nullableStr(body.subcopy);
  if (subcopy !== undefined) patch.subcopy = subcopy;
  const announcement = nullableStr(body.announcement);
  if (announcement !== undefined) patch.announcement = announcement;
  if (percentIn !== undefined) patch.discountPercent = percentIn;
  const sc = scope(body.scope);
  if (sc !== undefined) patch.scope = sc;
  const scopeValues = strArray(body.scopeValues);
  if (scopeValues !== undefined) patch.scopeValues = scopeValues;
  const startsAt = nullableStr(body.startsAt);
  if (startsAt !== undefined) patch.startsAt = startsAt;
  const endsAt = nullableStr(body.endsAt);
  if (endsAt !== undefined) patch.endsAt = endsAt;
  if (typeof body.active === "boolean") patch.active = body.active;
  const ctaLabel = str(body.ctaLabel);
  if (ctaLabel !== undefined) patch.ctaLabel = ctaLabel;
  const ctaHref = str(body.ctaHref);
  if (ctaHref !== undefined) patch.ctaHref = ctaHref;
  if (typeof body.autoMonth === "boolean") patch.autoMonth = body.autoMonth;
  const priority = num(body.priority);
  if (priority !== undefined) patch.priority = priority;

  try {
    const promotion = await updatePromotion(id, patch);
    if (!promotion) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "promotion.update",
      target: promotion.slug,
      meta: {
        active: promotion.active,
        discountPercent: promotion.discountPercent,
        scope: promotion.scope,
      },
    });
    // Activating / pausing / re-pricing a sale changes storefront prices — bust
    // the ISR cache everywhere so the change is visible within a second or two.
    revalidatePath("/", "layout");
    return Response.json({ ok: true, promotion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

/** DELETE — remove a promotion outright. Super-admin only. */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

  try {
    const removal = await deletePromotion(id);
    if (removal === "not-found") {
      return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "promotion.delete",
      target: id,
      meta: { removal },
    });
    // A deleted sale must stop discounting the storefront immediately.
    revalidatePath("/", "layout");
    return Response.json({ ok: true, removal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "delete-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
