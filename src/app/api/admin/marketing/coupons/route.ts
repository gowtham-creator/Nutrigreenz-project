/**
 * GET  /api/admin/marketing/coupons — list the whole coupon catalogue.
 * POST /api/admin/marketing/coupons — create a coupon.
 *
 * Super-admin only (see ../guard). Money is integer paise; a `percent` coupon's
 * `value` is a whole percent, a `flat` coupon's `value` is paise. Codes are
 * stored UPPERCASE and are unique — a duplicate returns 400. Every create is
 * written to the admin activity trail.
 */
import { requireSuperAdmin, superAdminEmail } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import { listCoupons, createCoupon, type CouponInput, type CouponKind } from "@/lib/rewards";

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

/** A nullable ISO-date string: null/blank → null (open-ended); absent → undefined. */
function nullableStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || (typeof v === "string" && !v.trim())) return null;
  return typeof v === "string" ? v.trim() : undefined;
}

/** GET — list all coupons, newest first. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const coupons = await listCoupons();
  return Response.json({ ok: true, coupons });
}

/** POST — create a coupon. Super-admin only. */
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

  const code = str(body.code);
  if (!code) return Response.json({ ok: false, error: "code-required" }, { status: 400 });
  const kind: CouponKind = body.kind === "percent" ? "percent" : "flat";
  const value = num(body.value) ?? 0;
  if (value <= 0) return Response.json({ ok: false, error: "value-required" }, { status: 400 });

  const input: CouponInput = { code, kind, value };
  const minOrder = num(body.minOrderPaise);
  if (minOrder !== undefined) input.minOrderPaise = minOrder;
  const cap = nullableNum(body.capPaise);
  if (cap !== undefined) input.capPaise = cap;
  if (typeof body.active === "boolean") input.active = body.active;
  const startsAt = nullableStr(body.startsAt);
  if (startsAt !== undefined) input.startsAt = startsAt;
  const endsAt = nullableStr(body.endsAt);
  if (endsAt !== undefined) input.endsAt = endsAt;
  const usageLimit = nullableNum(body.usageLimit);
  if (usageLimit !== undefined) input.usageLimit = usageLimit;
  const perCustomerLimit = nullableNum(body.perCustomerLimit);
  if (perCustomerLimit !== undefined) input.perCustomerLimit = perCustomerLimit;
  // Welcome / first-order flag — when on, the coupon requires an OTP-verified
  // phone and is enforced once-per-customer (createCoupon clamps the limit to 1).
  if (typeof body.requiresVerifiedPhone === "boolean") {
    input.requiresVerifiedPhone = body.requiresVerifiedPhone;
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
      },
    });
    return Response.json({ ok: true, coupon }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
