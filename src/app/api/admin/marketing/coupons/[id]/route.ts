/**
 * PATCH  /api/admin/marketing/coupons/[id] — edit a coupon's terms.
 * DELETE /api/admin/marketing/coupons/[id] — retire a coupon.
 *
 * Super-admin only (see ../../guard). The code itself is immutable once issued
 * (it may already be printed on campaign SMS), so PATCH edits only the terms.
 * DELETE never hard-deletes a coupon that has ANY recorded redemption — it is
 * only DEACTIVATED so the usage history (and the audit trail it gives orders)
 * survives; a never-used coupon is removed outright. Every mutation is logged.
 *
 * Unlike creating, editing does not demand dates: coupons made before dates were
 * required have none, and they must stay editable. Dates sent are still checked.
 */
import { requireSuperAdmin, superAdminEmail } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";
import { readCouponWindow } from "@/lib/coupon-dates";
import { withLengthValidation } from "@/lib/input-validation-guard";
import { readCustomerPhones } from "@/lib/phone-e164";
import { updateCoupon, removeCoupon, type CouponPatch, type CouponKind } from "@/lib/rewards";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";

type Ctx = { params: Promise<{ id: string }> };

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nullableNum(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Area-targeting list: array or comma/newline string; blank → null (no restriction). */
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

/** PATCH — edit a coupon's terms (not its code). Super-admin only. */
async function PATCHHandler(request: Request, ctx: Ctx): Promise<Response> {
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

  const dates = readCouponWindow(body);
  if (!dates.ok) return Response.json({ ok: false, error: "dates-invalid" }, { status: 400 });

  const customers = readCustomerPhones(body.customerPhones);
  if (!customers.ok) {
    return Response.json({ ok: false, error: "customer-phones-invalid" }, { status: 400 });
  }

  const patch: CouponPatch = {};
  if (body.kind === "percent" || body.kind === "flat") patch.kind = body.kind as CouponKind;
  const value = num(body.value);
  if (value !== undefined) patch.value = value;
  const minOrder = num(body.minOrderPaise);
  if (minOrder !== undefined) patch.minOrderPaise = minOrder;
  const cap = nullableNum(body.capPaise);
  if (cap !== undefined) patch.capPaise = cap;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (dates.startsAt !== undefined) patch.startsAt = dates.startsAt;
  if (dates.endsAt !== undefined) patch.endsAt = dates.endsAt;
  const usageLimit = nullableNum(body.usageLimit);
  if (usageLimit !== undefined) patch.usageLimit = usageLimit;
  const perCustomerLimit = nullableNum(body.perCustomerLimit);
  if (perCustomerLimit !== undefined) patch.perCustomerLimit = perCustomerLimit;
  if (typeof body.requiresVerifiedPhone === "boolean") {
    patch.requiresVerifiedPhone = body.requiresVerifiedPhone;
  }
  const pincodes = nullableList(body.pincodes);
  if (pincodes !== undefined) patch.pincodes = pincodes;
  const communities = nullableList(body.communities);
  if (communities !== undefined) patch.communities = communities;
  const productIds = nullableList(body.productIds);
  if (productIds !== undefined) patch.productIds = productIds;
  if (customers.phones !== undefined) patch.customerPhones = customers.phones;
  if (typeof body.stackLoyalty === "boolean") patch.stackLoyalty = body.stackLoyalty;
  if (body.description !== undefined) {
    patch.description = strictText(body.description, TEXT_LIMITS.headline, "Description") || null;
  }

  try {
    const coupon = await updateCoupon(id, patch);
    if (!coupon) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: "coupon.update",
      target: coupon.code,
      meta: {
        active: coupon.active,
        value: coupon.value,
        kind: coupon.kind,
        customerCount: coupon.customerPhones?.length ?? null,
        stackLoyalty: coupon.stackLoyalty,
      },
    });
    return Response.json({ ok: true, coupon });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export const PATCH = withLengthValidation(PATCHHandler);

/** DELETE — retire a coupon (deactivate if used, hard-delete if never used). */
export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

  try {
    const removal = await removeCoupon(id);
    if (removal === "not-found") {
      return Response.json({ ok: false, error: "not-found" }, { status: 404 });
    }
    await logActivity({
      actorEmail: await superAdminEmail(),
      actorRole: "superadmin",
      action: removal === "deleted" ? "coupon.delete" : "coupon.deactivate",
      target: id,
      meta: { removal },
    });
    return Response.json({ ok: true, removal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "delete-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
