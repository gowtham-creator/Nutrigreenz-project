import { cookies } from "next/headers";
import { isAdminConfigured, verifyIdToken } from "@/lib/firebase-admin";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { NG_SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import {
  attachVerifiedPhone,
  getCustomerByIdentity,
  resolveCustomer,
} from "@/lib/customer-identity";

// firebase-admin (jose) needs the Node runtime (not Edge).
export const runtime = "nodejs";

/**
 * POST /api/auth/link-phone  { idToken: string }
 *
 * Customer-identity dedup (Task T3). After a GOOGLE customer OTP-proves
 * ownership of a phone number, the client sends a Firebase PHONE ID token here.
 * We:
 *   1. authenticate the caller via the signed `ng_session` cookie (the live
 *      Google/phone session) → Firebase UID,
 *   2. verify the supplied PHONE ID token server-side and require it to be a
 *      genuine phone sign-in carrying a phone number (verified-by-construction),
 *   3. resolve the caller's canonical customer (from `users.customer_id`, or by
 *      resolving the current Google identity when the backlink isn't stamped yet),
 *   4. attach the verified phone — merging into any existing phone-keyed
 *      customer (older row survives) via {@link attachVerifiedPhone}.
 *
 * Best-effort + fail-safe: any non-fatal hiccup returns `{ ok: true, merged:false }`
 * so the additive mobile-capture prompt can never break the Google session. The
 * phone OTP itself is the security boundary — a caller can only link a number
 * they just proved they control.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAdminConfigured) {
    return Response.json({ ok: false, error: "auth-unavailable" }, { status: 503 });
  }

  // 1. Authenticate the caller via the signed ng_session cookie.
  const c = await cookies();
  const sessionUid = await verifySessionToken(c.get(NG_SESSION_COOKIE)?.value);
  if (!sessionUid) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let idToken: unknown;
  try {
    idToken = (await request.json())?.idToken;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // 2. Verify the PHONE ID token (fail closed) and require a phone sign-in.
  let phoneNumber: string;
  try {
    const decoded = await verifyIdToken(idToken);
    const provider = decoded.firebase?.sign_in_provider;
    if (provider !== "phone" || !decoded.phone_number) {
      return Response.json({ ok: false, error: "not-phone" }, { status: 401 });
    }
    phoneNumber = decoded.phone_number;
  } catch (err) {
    console.error(
      "[link-phone] verifyIdToken failed:",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ ok: false, error: "verify-failed" }, { status: 401 });
  }

  // 3 + 4. Resolve the caller's canonical customer, then attach the phone.
  // Best-effort: Supabase unconfigured or a transient DB error must never break
  // the (already-established) Google session — just report no merge.
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, merged: false });
  }

  try {
    // 3a. Prefer the stamped backlink on the live `users` row.
    let customerId: string | null = null;
    const { data: userRow } = await supabaseAdmin()
      .from("users")
      .select("customer_id")
      .eq("firebase_uid", sessionUid)
      .maybeSingle();
    const linked = (userRow as { customer_id: string | null } | null)?.customer_id;
    if (linked) customerId = linked;

    // 3b. Fall back to the current Google identity (resolve-or-create), so a
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
      return Response.json({ ok: true, merged: false });
    }

    const result = await attachVerifiedPhone(customerId, phoneNumber);
    return Response.json({ ok: true, merged: result.merged });
  } catch (err) {
    console.error(
      "[link-phone] attach failed:",
      err instanceof Error ? err.message : String(err),
    );
    // Fail safe — the prompt is additive; never surface as a hard error.
    return Response.json({ ok: true, merged: false });
  }
}
