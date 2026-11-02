/**
 * GET  /api/admin/marketing/coupons — list the whole coupon catalogue.
 * POST /api/admin/marketing/coupons — create a coupon.
 *
 * Super-admin only (see ../guard). Money is integer paise; a `percent` coupon's
 * `value` is a whole percent, a `flat` coupon's `value` is paise. Codes are
 * stored UPPERCASE and are unique — a duplicate returns 400. Every create is
 * written to the admin activity trail.
 *
 * A new coupon must have a start and an end date. The check lives here rather
 * than in `createCoupon` because this is the door operators come through; the
 * rule is about what they may create, not about what a coupon row can be, and
 * older coupons with no dates remain valid. Dates arrive as IST calendar days
 * and are stored as instants, see `@/lib/coupon-dates`.
 */
import { requireSuperAdmin, superAdminEmail } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import { readCouponWindow } from "@/lib/coupon-dates";
import { withLengthValidation } from "@/lib/input-validation-guard";
import { readCustomerPhones } from "@/lib/phone-e164";
import { listCoupons, createCoupon, type CouponInput, type CouponKind } from "@/lib/rewards";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";

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

/** A nullable number: explicit null/"" → null (unlimited/uncapped); absent → undefined. */
function nullableNum(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A targeting list (pincodes / communities). Accepts either an array or a
 * comma/newline-separated string from the admin form. Blank → null ("no
 * restriction"); absent → undefined (leave unchanged).
 */
function nullableList(v: unknown): string[] | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const parts = Array.isArray(v)
    ? v.map((x) => (typeof x === "string" ? x : String(x ?? "")))
    : typeof v === "string"
      ? v.split(/[\n,]/)
      : [];
  const out = Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean)));
  return out.length > 0 ? out : null;
}

/** GET — list all coupons, newest first. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const coupons = await listCoupons();
  return Response.json({ ok: true, coupons });
}

/** POST — create a coupon. Super-admin only. */
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

  const code = str(body.code);
  if (!code) return Response.json({ ok: false, error: "code-required" }, { status: 400 });
  const kind: CouponKind = body.kind === "percent" ? "percent" : "flat";
  const value = num(body.value) ?? 0;
  if (value <= 0) return Response.json({ ok: false, error: "value-required" }, { status: 400 });

  const dates = readCouponWindow(body);
  if (!dates.ok) return Response.json({ ok: false, error: "dates-invalid" }, { status: 400 });
  if (!dates.startsAt || !dates.endsAt) {
    return Response.json({ ok: false, error: "dates-required" }, { status: 400 });
  }

  const customers = readCustomerPhones(body.customerPhones);
  if (!customers.ok) {
    return Response.json({ ok: false, error: "customer-phones-invalid" }, { status: 400 });
  }

  const input: CouponInput = {
    code,
    kind,
    value,
    startsAt: dates.startsAt,
    endsAt: dates.endsAt,
  };
  const minOrder = num(body.minOrderPaise);
  if (minOrder !== undefined) input.minOrderPaise = minOrder;
  const cap = nullableNum(body.capPaise);
  if (cap !== undefined) input.capPaise = cap;
  if (typeof body.active === "boolean") input.active = body.active;
  const usageLimit = nullableNum(body.usageLimit);
  if (usageLimit !== undefined) input.usageLimit = usageLimit;
  const perCustomerLimit = nullableNum(body.perCustomerLimit);
  if (perCustomerLimit !== undefined) input.perCustomerLimit = perCustomerLimit;
  // Welcome / first-order flag — when on, the coupon requires an OTP-verified
  // phone and is enforced once-per-customer (createCoupon clamps the limit to 1).
  if (typeof body.requiresVerifiedPhone === "boolean") {
    input.requiresVerifiedPhone = body.requiresVerifiedPhone;
  }
  // Area targeting — restrict the code to specific delivery pincodes and/or
  // gated communities. Both blank = valid everywhere (the default).
  const pincodes = nullableList(body.pincodes);
  if (pincodes !== undefined) input.pincodes = pincodes;
  const communities = nullableList(body.communities);
  if (communities !== undefined) input.communities = communities;
  // Product targeting — restrict the code to specific products. Blank = every
  // product, which is the default and what almost every coupon wants.
  const productIds = nullableList(body.productIds);
  if (productIds !== undefined) input.productIds = productIds;
  // Customer targeting — only these numbers may redeem or be sent this code.
  if (customers.phones !== undefined) input.customerPhones = customers.phones;
  if (typeof body.stackLoyalty === "boolean") input.stackLoyalty = body.stackLoyalty;
  // Goes into campaign SMS and email as the offer's title, so it is held to a
  // headline's length and cleaned like any other marketing copy.
  if (body.description !== undefined) {
    input.description = strictText(body.description, TEXT_LIMITS.headline, "Description") || null;
  }

  try {
    const coupon = await createCoupon(input);
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "coupon.create",
      target: coupon.code,
      meta: {
        kind: coupon.kind,
        value: coupon.value,
        active: coupon.active,
        requiresVerifiedPhone: coupon.requiresVerifiedPhone,
        pincodes: coupon.pincodes,
        productIds: coupon.productIds,
        communities: coupon.communities,
        // The count, not the numbers: the trail shouldn't accumulate phone numbers.
        customerCount: coupon.customerPhones?.length ?? null,
        stackLoyalty: coupon.stackLoyalty,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
      },
    });
    return Response.json({ ok: true, coupon }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export const POST = withLengthValidation(POSTHandler);
