/**
 * GET  /api/admin/marketing/promotions — list the whole promotion catalogue.
 * POST /api/admin/marketing/promotions — create a promotion.
 *
 * Super-admin only (see ../guard), mirroring the coupon admin surface. `bannerKey`
 * must be one of the nine shipped banners and `discountPercent` a whole 1..90;
 * the slug is derived from the title when absent and must be unique (a duplicate
 * returns 400). Every create is written to the admin activity trail.
 */
import { revalidatePath } from "next/cache";
import { requireSuperAdmin, superAdminEmail } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import {
  listPromotions,
  createPromotion,
  isBannerKey,
  type PromotionInput,
  type PromotionScope,
} from "@/lib/promotions";

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

/** A nullable ISO-date string: null/blank → null (open-ended); absent → undefined. */
function nullableStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === "string" && !v.trim())) return null;
  return typeof v === "string" ? v.trim() : undefined;
}

/** A validated scope, else undefined (falls back to the column default 'all'). */
function scope(v: unknown): PromotionScope | undefined {
  return v === "all" || v === "category" || v === "product" ? v : undefined;
}

/** A cleaned string[] of scope values, else undefined. */
function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

/** GET — list all promotions, highest priority first. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const promotions = await listPromotions();
  return Response.json({ ok: true, promotions });
}

/** POST — create a promotion. Super-admin only. */
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

  const title = str(body.title);
  if (!title) return Response.json({ ok: false, error: "title-required" }, { status: 400 });
  const bannerKey = str(body.bannerKey);
  if (!bannerKey || !isBannerKey(bannerKey)) {
    return Response.json({ ok: false, error: "invalid-banner-key" }, { status: 400 });
  }
  const headline = str(body.headline);
  if (!headline) return Response.json({ ok: false, error: "headline-required" }, { status: 400 });
  const discountPercent = num(body.discountPercent);
  if (discountPercent === undefined || discountPercent < 1 || discountPercent > 90) {
    return Response.json({ ok: false, error: "invalid-discount-percent" }, { status: 400 });
  }

  const input: PromotionInput = { title, bannerKey, headline, discountPercent };
  const slug = str(body.slug);
  if (slug !== undefined) input.slug = slug;
  const subcopy = nullableStr(body.subcopy);
  if (subcopy !== undefined) input.subcopy = subcopy;
  const announcement = nullableStr(body.announcement);
  if (announcement !== undefined) input.announcement = announcement;
  const sc = scope(body.scope);
  if (sc !== undefined) input.scope = sc;
  const scopeValues = strArray(body.scopeValues);
  if (scopeValues !== undefined) input.scopeValues = scopeValues;
  const startsAt = nullableStr(body.startsAt);
  if (startsAt !== undefined) input.startsAt = startsAt;
  const endsAt = nullableStr(body.endsAt);
  if (endsAt !== undefined) input.endsAt = endsAt;
  if (typeof body.active === "boolean") input.active = body.active;
  const ctaLabel = str(body.ctaLabel);
  if (ctaLabel !== undefined) input.ctaLabel = ctaLabel;
  const ctaHref = str(body.ctaHref);
  if (ctaHref !== undefined) input.ctaHref = ctaHref;
  if (typeof body.autoMonth === "boolean") input.autoMonth = body.autoMonth;
  const priority = num(body.priority);
  if (priority !== undefined) input.priority = priority;

  try {
    const promotion = await createPromotion(input);
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "promotion.create",
      target: promotion.slug,
      meta: {
        bannerKey: promotion.bannerKey,
        discountPercent: promotion.discountPercent,
        scope: promotion.scope,
        active: promotion.active,
      },
    });
    // Bust the ISR cache across the whole storefront so a newly-created (active)
    // sale shows on the hero + every product card near-instantly, not after the
    // page's revalidate window elapses.
    revalidatePath("/", "layout");
    return Response.json({ ok: true, promotion }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
