import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { NG_SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import {
  getCustomerByIdentity,
  resolveCustomer,
} from "@/lib/customer-identity";
import { enrichFromGoogle } from "@/lib/google-people";

// The Google People API fetch + supabase-admin need the Node runtime (not Edge).
export const runtime = "nodejs";

/**
 * POST /api/auth/google-enrich  { accessToken: string }
 *
 * Customer-identity dedup (Task T6) — People API auto-fetch, Decision C. After a
 * GOOGLE sign-in the client captures the Google OAuth ACCESS token
 * (`GoogleAuthProvider.credentialFromResult(result)?.accessToken`) and POSTs it
 * here. We:
 *   1. authenticate the caller via the signed `ng_session` cookie → Firebase UID,
 *   2. resolve the caller's CANONICAL customer (stamped `users.customer_id`, or
 *      the current Google identity when the backlink isn't present yet),
 *   3. best-effort enrich from the Google People API — auto-import the account's
 *      addresses (own data; first → Home + default; idempotent) and set the
 *      OWN `primary_phone` when it collides with NO other customer; a COLLIDING
 *      number is returned as `prefillPhone` for the takeover-safe T3 OTP step.
 *
 * GRACEFUL NO-OP by contract: a missing token, denied scopes (403), an empty
 * People-API profile, an unconfigured backend, or ANY transient error returns
 * `{ ok: true, enriched: false }` — Google sign-in is never blocked and the T3
 * manual prompt remains the fallback. The People-API phone is NEVER auto-merged
 * into another customer; only the OTP step (link-phone) may do that.
 */
export async function POST(request: Request): Promise<Response> {
  // 1. Authenticate the caller via the signed ng_session cookie.
  const c = await cookies();
  const sessionUid = await verifySessionToken(c.get(NG_SESSION_COOKIE)?.value);
  if (!sessionUid) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let accessToken: unknown;
  try {
    accessToken = (await request.json())?.accessToken;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  // A missing/blank token is the "scopes denied / no People access" path → no-op.
  if (typeof accessToken !== "string" || !accessToken) {
    return Response.json({ ok: true, enriched: false });
  }

  // Supabase unconfigured → nothing to enrich; never break the Google session.
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, enriched: false });
  }

  try {
    // 2a. Prefer the stamped backlink on the live `users` row.
    let customerId: string | null = null;
    const { data: userRow } = await supabaseAdmin()
      .from("users")
      .select("customer_id")
      .eq("firebase_uid", sessionUid)
      .maybeSingle();
    const linked = (userRow as { customer_id: string | null } | null)?.customer_id;
    if (linked) customerId = linked;

    // 2b. Fall back to the current Google identity (resolve-or-create), so a
    // session minted before the dedup backlink existed still resolves cleanly.
    if (!customerId) {
      const existing = await getCustomerByIdentity("google", sessionUid);
      if (existing) {
        customerId = existing.customer.id;
      } else {
        const resolved = await resolveCustomer({
          provider: "google",
          providerUid: sessionUid,
        });
        customerId = resolved.customer.id;
      }
    }

    if (!customerId) {
      return Response.json({ ok: true, enriched: false });
    }

    // 3. Best-effort People-API enrichment (own addresses + takeover-safe phone).
    const result = await enrichFromGoogle(customerId, accessToken);
    return Response.json({
      ok: true,
      enriched: result.enriched,
      addressesAdded: result.addressesAdded,
      ...(result.prefillPhone ? { prefillPhone: result.prefillPhone } : {}),
    });
  } catch (err) {
    console.error(
      "[google-enrich] enrich failed:",
      err instanceof Error ? err.message : String(err),
    );
    // Fail safe — enrichment is additive; never surface as a hard error.
    return Response.json({ ok: true, enriched: false });
  }
}
