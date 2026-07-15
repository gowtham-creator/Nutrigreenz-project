import { getCustomerSession } from "@/lib/customer-session";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { reverseGeocode } from "@/lib/geo-locate";
import type { AutoDetectedLocation } from "@/types/nutrigreenz";

/**
 * POST /api/geo/detect — resolve GPS coordinates to a delivery area + pincode.
 *
 * The storefront "Deliver to" control calls this after the browser grants a
 * high-accuracy geolocation fix. We reverse-geocode server-side (accurate for
 * India, and the right place to keep the geocoder + its API policy), derive the
 * pincode, and resolve the area through the SAME pincode→area lookup that manual
 * entry uses — so auto-detect and typing a pincode always agree.
 *
 * Side effect (best-effort, privacy-safe): when the caller is a signed-in
 * customer who has NOT saved a delivery address yet, we persist the detected
 * hint onto their `customers` row. Anonymous callers persist nothing. Any
 * persistence failure is swallowed so it can never block the response.
 *
 * Body: `{ lat: number, lng: number }`. Responds
 * `{ ok: true, area, pincode, city, lat, lng }`, or `{ ok: false }` when the
 * coordinates can't be resolved (the client then falls back to its own mock).
 */

/**
 * Persist the latest detected hint for a signed-in customer so admins can see
 * where each customer actually is. It is informational only — it lives in its
 * own `auto_detected_location` column and never overrides the delivery address
 * the customer chooses at checkout. Anonymous callers store nothing (anonymous
 * browsing stays anonymous). Never throws.
 */
async function persistIfEligible(zone: AutoDetectedLocation): Promise<void> {
  if (!isSupabaseConfigured) return;

  const session = await getCustomerSession();
  if (!session) return; // anonymous → store nothing

  await supabaseAdmin()
    .from("customers")
    .update({ auto_detected_location: zone })
    .eq("id", session.customerId)
    .is("merged_into", null);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const { lat, lng } = (body ?? {}) as { lat?: unknown; lng?: unknown };
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return Response.json({ ok: false, error: "bad-coords" }, { status: 400 });
  }

  const geo = await reverseGeocode(lat, lng);
  if (!geo) return Response.json({ ok: false, error: "unresolved" });

  const zone: AutoDetectedLocation = {
    area: geo.area,
    pincode: geo.pincode,
    city: geo.city,
    lat,
    lng,
    detectedAt: new Date().toISOString(),
  };

  try {
    await persistIfEligible(zone);
  } catch {
    /* best-effort persistence only — never fail the geocode response */
  }

  return Response.json({
    ok: true,
    area: zone.area,
    pincode: zone.pincode,
    city: zone.city,
    lat,
    lng,
  });
}
