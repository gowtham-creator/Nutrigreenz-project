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
import { strictText, TEXT_LIMITS } from "@/lib/sanitize-text";
import { withLengthValidation } from "@/lib/input-validation-guard";

/*
 * Every string below is capped and stripped, not merely trimmed.
 *
 * The previous helper checked only that a value was non-empty after trimming,
 * which let a promotion store 22 KB in `title`, 25 KB in `headline` and 23 KB
 * in `subcopy`. That row went LIVE: the storefront served ~70 KB of junk on
 * every page load and the top marquee scrolled one unbroken word.
 *
 * `plainText` also removes tags, template braces and bidi overrides, so this
 * surface matches the rest of the admin API instead of being the one door left
 * open — see sanitize-text.ts for why input is cleaned even though output is
 * already escaped.
 */

/** A cleaned, length-capped non-empty string, else undefined. */
function str(v: unknown, max: number = TEXT_LIMITS.name): string | undefined {
  const s = strictText(v, max, "Field");
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

/**
 * A nullable string: null/blank → null (clears the field); absent → undefined.
 *
 * `max` is optional because this also carries ISO dates, which are fixed-format
 * and must not be run through the prose cleaner.
 */
function nullableStr(v: unknown, max?: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === "string" && !v.trim())) return null;
  if (typeof v !== "string") return undefined;
  if (max === undefined) return v.trim();
  return strictText(v, max, "Field") || null;
}

/** A validated scope, else undefined (falls back to the column default 'all'). */
function scope(v: unknown): PromotionScope | undefined {
  return v === "all" || v === "category" || v === "product" || v === "variant" ? v : undefined;
}

/**
 * A cleaned string[] of scope values, else undefined.
 *
 * Bounded on BOTH axes — each entry is a slug, and the list cannot exceed the
 * catalogue by any sane margin. Capping the strings alone would still let a
 * request store a hundred thousand of them.
 */
function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .slice(0, 200)
    .map((x) => strictText(x, TEXT_LIMITS.slug, "Field"))
    .filter((x) => x.length > 0);
}

/** GET — list all promotions, highest priority first. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const promotions = await listPromotions();
  return Response.json({ ok: true, promotions });
}

/** POST — create a promotion. Super-admin only. */
async function POSTHandler(request: Request): Promise<Response> {
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

  const title = str(body.title, TEXT_LIMITS.name);
  if (!title) return Response.json({ ok: false, error: "title-required" }, { status: 400 });
  const bannerKey = str(body.bannerKey, TEXT_LIMITS.slug);
  if (!bannerKey || !isBannerKey(bannerKey)) {
    return Response.json({ ok: false, error: "invalid-banner-key" }, { status: 400 });
  }
  const headline = str(body.headline, TEXT_LIMITS.headline);
  if (!headline) return Response.json({ ok: false, error: "headline-required" }, { status: 400 });
  const discountPercent = num(body.discountPercent);
  if (discountPercent === undefined || discountPercent < 1 || discountPercent > 90) {
    return Response.json({ ok: false, error: "invalid-discount-percent" }, { status: 400 });
  }

  const input: PromotionInput = { title, bannerKey, headline, discountPercent };
  const slug = str(body.slug, TEXT_LIMITS.slug);
  if (slug !== undefined) input.slug = slug;
  const subcopy = nullableStr(body.subcopy, TEXT_LIMITS.subcopy);
  if (subcopy !== undefined) input.subcopy = subcopy;
  const announcement = nullableStr(body.announcement, TEXT_LIMITS.announcement);
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
  const ctaLabel = str(body.ctaLabel, TEXT_LIMITS.cta);
  if (ctaLabel !== undefined) input.ctaLabel = ctaLabel;
  const ctaHref = str(body.ctaHref, TEXT_LIMITS.slug);
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


export const POST = withLengthValidation(POSTHandler);
