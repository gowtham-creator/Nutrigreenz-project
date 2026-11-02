import { getStorefrontFlags } from "@/lib/referrals";

// Always evaluated at request time — never statically pre-rendered at build.
export const dynamic = "force-dynamic";

/**
 * Public storefront read of the live feature flags — NO auth. Returns the full
 * key → enabled map so client components can hide what is switched off. Pages
 * and APIs are gated on the server; this only tidies the links to them.
 *
 * Falls back to the built-in defaults when the DB is unconfigured, so the
 * storefront never breaks.
 */
export async function GET(): Promise<Response> {
  try {
    const flags = await getStorefrontFlags();
    return Response.json(
      { ok: true, flags },
      // Never cached: a switch the Super Admin turns off must be off on the
      // next read, not up to six minutes later from the CDN.
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
