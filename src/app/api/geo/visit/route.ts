import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/geo/visit — count one visit against its city.
 *
 * ── What is and is not recorded ───────────────────────────────────────────
 *
 * A counter for (today, country, region, city) is incremented. Nothing else is
 * written: no IP address, no session identifier, no customer id, and no time
 * finer than the date. The stored row cannot be narrowed to a person even by
 * someone holding the table, which is what keeps this aggregate statistics
 * rather than the profiling the DPDP Act governs.
 *
 * The location comes from Vercel's edge headers, resolved from the connecting
 * IP before the request reaches this function. So the visitor is never asked
 * for permission — there is no browser geolocation prompt to decline — and the
 * IP itself is read, used and discarded inside this request.
 *
 * ── Why it is unauthenticated ─────────────────────────────────────────────
 *
 * It has to run for signed-out browsers, which is most of the traffic and the
 * whole point. The blast radius is a wrong number in a dashboard: the endpoint
 * writes through a SECURITY DEFINER function that can only ever increment one
 * bucket, and reads nothing back. Someone determined can inflate a city's
 * count; they cannot learn anything, reach another row, or identify anyone.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, recorded: false }, { status: 202 });
  }

  const h = request.headers;
  /*
   * Vercel's own resolution, not a third-party lookup. The values arrive
   * percent-encoded because city names carry spaces and accents.
   */
  const decode = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v).trim().slice(0, 80);
    } catch {
      return v.trim().slice(0, 80);
    }
  };

  const country = decode(h.get("x-vercel-ip-country"));
  const region = decode(h.get("x-vercel-ip-country-region"));
  const city = decode(h.get("x-vercel-ip-city"));

  // Nothing resolved (local dev, or an edge that could not place the address) —
  // recording an "unknown/unknown/unknown" row every time would only add noise.
  if (!country && !region && !city) {
    return Response.json({ ok: true, recorded: false }, { status: 202 });
  }

  try {
    await supabaseAdmin().rpc("record_visit_geo", {
      p_country: country,
      p_region: region,
      p_city: city,
    });
  } catch {
    // A counter is never worth failing a page view over.
  }

  return Response.json({ ok: true, recorded: true }, { headers: { "cache-control": "no-store" } });
}
