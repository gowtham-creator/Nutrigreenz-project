import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { listCoupons, validateCouponServer } from "@/lib/rewards";

export const runtime = "nodejs";
// Usage counts and validity windows move; a cached list would offer a code that
// has since run out.
export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/available-coupons — what this customer could use right now.
 *
 * Checkout only had a "type your code" box, so a coupon the customer had never
 * heard of was worth nothing. This lists the codes that exist and runs each one
 * through the SAME {@link validateCouponServer} that authorises the discount, so
 * the list cannot promise something the apply step then refuses.
 *
 * Codes are returned in two groups:
 *   - eligible: applies now, with the exact discount it would give
 *   - almostThere: fails ONLY on the minimum order, with the shortfall
 *
 * Everything else is omitted entirely. Showing a customer a code they can never
 * use — wrong pincode, wrong products, already used, expired — is noise that
 * reads as a broken coupon. "Add ₹150 more" is actionable; "not available in
 * your area" is not.
 *
 * Body: `{ subtotalPaise, pincode?, productIds? }`.
 */

interface OfferedCoupon {
  code: string;
  kind: "percent" | "flat";
  value: number;
  minOrderPaise: number;
  capPaise: number | null;
  endsAt: string | null;
  /** Discount this code gives on the current cart, in paise. */
  discountPaise: number;
  /** Paise still needed to qualify — `almostThere` entries only. */
  shortfallPaise?: number;
}

function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  /*
   * Signed in only. Per-customer limits and first-order gates cannot be
   * evaluated for an anonymous visitor, so an anonymous list would advertise
   * codes that fail the moment they are applied.
   */
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const subtotalPaise = Math.max(0, int(body.subtotalPaise));
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : null;
  const productIds = Array.isArray(body.productIds)
    ? body.productIds.filter((id): id is string => typeof id === "string" && Boolean(id))
    : [];

  const all = await listCoupons();
  const now = new Date();

  const eligible: OfferedCoupon[] = [];
  const almostThere: OfferedCoupon[] = [];

  await Promise.all(
    all.map(async (c) => {
      if (!c.active) return;
      // Cheap pre-filters before the per-coupon round trip.
      if (c.endsAt && new Date(c.endsAt) < now) return;
      if (c.startsAt && new Date(c.startsAt) > now) return;

      const base = {
        code: c.code,
        kind: c.kind,
        value: c.value,
        minOrderPaise: c.minOrderPaise,
        capPaise: c.capPaise,
        endsAt: c.endsAt,
      };

      const check = await validateCouponServer(c.code, subtotalPaise, session.customerId, {
        pincode,
        productIds,
        now,
      });

      if (check.valid) {
        eligible.push({ ...base, discountPaise: check.discountPaise });
        return;
      }

      /*
       * "Below minimum" is the one rejection worth surfacing: it is the only one
       * the customer can act on from the cart, and it is what drives the "add
       * ₹150 more to save ₹100" nudge.
       *
       * It is re-checked at the coupon's own minimum so the quote is honest —
       * a percent coupon's discount at the current subtotal would understate
       * what they would actually get once they qualify.
       */
      if (check.reason === "below-min") {
        const atMin = await validateCouponServer(c.code, c.minOrderPaise, session.customerId, {
          pincode,
          productIds,
          now,
        });
        // Only offer it if it would genuinely apply at the minimum — otherwise
        // the customer spends more and still cannot use the code.
        if (atMin.valid) {
          almostThere.push({
            ...base,
            discountPaise: atMin.discountPaise,
            shortfallPaise: Math.max(0, c.minOrderPaise - subtotalPaise),
          });
        }
      }
    }),
  );

  // Best saving first — the order a customer scans in.
  eligible.sort((a, b) => b.discountPaise - a.discountPaise);
  // Closest to reach first: the nudge that costs them least.
  almostThere.sort((a, b) => (a.shortfallPaise ?? 0) - (b.shortfallPaise ?? 0));

  return Response.json(
    { ok: true, eligible, almostThere },
    { headers: { "cache-control": "no-store" } },
  );
}
