import { verifyIdToken, isAdminConfigured } from "@/lib/firebase-admin";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCaptainByPhone, toCaptainMe } from "@/lib/captains";
import { mintCaptainSession } from "@/lib/captain-session";

/**
 * POST /api/captain/login  { idToken }
 *
 * The captain field tool's sign-in. The client completes Firebase phone-OTP
 * (reusing the storefront's phone-auth flow) and posts the resulting Firebase
 * ID token. We verify it server-side (`verifyIdToken`, JWKS — no service-account
 * key), extract the verified `phone_number`, and resolve it to a captain.
 *
 * Access is granted ONLY when the number belongs to an ACTIVE captain; otherwise
 * we fail closed with a single, non-enumerating message. On success we mint the
 * signed httpOnly `ng_captain` session cookie the proxy checks on every
 * `/captain/*` request.
 *
 * This lives under `/api/...`, so the proxy matcher does not gate it.
 */

const NOT_A_CAPTAIN = "This number isn't registered as an active captain.";

export async function POST(request: Request): Promise<Response> {
  let idToken: unknown;
  try {
    const body = await request.json();
    idToken = body?.idToken;
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length === 0) {
    return Response.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  // Fail closed (503) when the pieces needed to authenticate aren't configured,
  // rather than throwing into an unhandled 500.
  if (!isAdminConfigured) {
    return Response.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let phone: string | null = null;
  try {
    const decoded = await verifyIdToken(idToken);
    phone = decoded.phone_number ?? null;
  } catch {
    return Response.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
  if (!phone) {
    return Response.json({ ok: false, error: "no_phone" }, { status: 401 });
  }

  const captain = await getCaptainByPhone(phone);
  // Same status + message whether the number is unknown or inactive — never
  // reveal which, and never sign in a disabled captain.
  if (!captain || !captain.active) {
    return Response.json({ ok: false, error: "not_a_captain", message: NOT_A_CAPTAIN }, { status: 403 });
  }

  await mintCaptainSession(captain.id, captain.phone);
  return Response.json({ ok: true, captain: toCaptainMe(captain) });
}
