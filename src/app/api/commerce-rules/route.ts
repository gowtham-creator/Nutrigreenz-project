import { getPublicCommerceRules } from "@/lib/commerce-rules";

// Always evaluated at request time — never statically pre-rendered at build.
export const dynamic = "force-dynamic";

/**
 * Public storefront read of the live commerce rules — NO auth. Returns only the
 * customer-facing subset (min order value, free-delivery threshold, shipping,
 * tax mode + active delivery slots) via `getPublicCommerceRules()`. The cart and
 * checkout read this to keep their economics in sync with the Super Admin config.
 *
 * Money fields are integer paise. Falls back to sane defaults when the DB is
 * unconfigured, so the storefront never breaks.
 */
export async function GET(): Promise<Response> {
  try {
    const rules = await getPublicCommerceRules();
    return Response.json(
      { ok: true, rules },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
