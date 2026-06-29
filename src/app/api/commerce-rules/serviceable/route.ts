import { isServiceable } from "@/lib/commerce-rules";

// Always evaluated at request time — never statically pre-rendered at build.
export const dynamic = "force-dynamic";

/**
 * Public serviceability check — NO auth. Answers whether the storefront delivers
 * to a given pincode, backed by the Super Admin `serviceable_areas` list via
 * `isServiceable(pincode)`. Checkout calls this to gate placing an order, and the
 * delivery pill uses it to reflect coverage.
 *
 * `GET /api/commerce-rules/serviceable?pincode=500081`
 *  → `{ ok: true, pincode, serviceable: boolean }`
 *
 * Non-blocking by design: when no areas are configured (or the DB is
 * unconfigured), `isServiceable` returns true so checkout is never wrongly blocked.
 */
export async function GET(request: Request): Promise<Response> {
  const pincode = (new URL(request.url).searchParams.get("pincode") ?? "").trim();
  if (!/^\d{6}$/.test(pincode)) {
    return Response.json({ ok: false, error: "invalid-pincode" }, { status: 400 });
  }
  try {
    const serviceable = await isServiceable(pincode);
    return Response.json(
      { ok: true, pincode, serviceable },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
