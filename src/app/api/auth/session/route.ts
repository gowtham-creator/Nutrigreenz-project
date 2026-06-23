import { cookies } from "next/headers";
import {
  isAdminConfigured,
  verifyIdToken,
  type DecodedIdToken,
} from "@/lib/firebase-admin";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { NG_SESSION_COOKIE, createSessionToken } from "@/lib/session";

// firebase-admin needs the Node runtime (not Edge).
export const runtime = "nodejs";

/** Session lifetime: 30 days (seconds). */
const MAX_AGE = 60 * 60 * 24 * 30;

/** Normalise Firebase's sign-in provider to our short `provider` tag. */
function providerTag(decoded: DecodedIdToken): string {
  const p = decoded.firebase?.sign_in_provider;
  if (p === "phone") return "phone";
  if (p === "google.com") return "google";
  return p ?? "unknown";
}

/**
 * POST /api/auth/session  { idToken: string }
 *
 * Customer sign-in backbone. After the client completes Firebase sign-in
 * (Google or phone OTP) it posts the resulting Firebase ID token here. We:
 *   1. verify the token server-side with the Firebase Admin SDK,
 *   2. upsert the matching row in `public.users` (keyed by `firebase_uid`),
 *   3. mint a signed, httpOnly `ng_session` cookie bound to the UID.
 *
 * The upsert is best-effort: if Supabase is unconfigured or briefly unavailable
 * the session still mints, so sign-in never breaks on a transient DB hiccup.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAdminConfigured) {
    return Response.json({ ok: false, error: "auth-unavailable" }, { status: 503 });
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

  // 1. Verify the Firebase ID token (fail closed).
  let decoded: DecodedIdToken;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    return Response.json({ ok: false }, { status: 401 });
  }

  // 2. Upsert the user record — best-effort, never blocks the session.
  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin()
        .from("users")
        .upsert(
          {
            firebase_uid: decoded.uid,
            email: decoded.email ?? null,
            phone: decoded.phone_number ?? null,
            full_name: decoded.name ?? null,
            photo_url: decoded.picture ?? null,
            provider: providerTag(decoded),
            last_login_at: new Date().toISOString(),
          },
          { onConflict: "firebase_uid" },
        );
    } catch {
      // Swallow — the signed session still mints; the row reconciles next login.
    }
  }

  // 3. Mint the signed, httpOnly session cookie bound to the UID.
  const token = await createSessionToken(decoded.uid);
  const c = await cookies();
  c.set({
    name: NG_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return Response.json({ ok: true });
}

/** DELETE /api/auth/session — clear the customer session cookie (sign-out). */
export async function DELETE(): Promise<Response> {
  const c = await cookies();
  c.delete(NG_SESSION_COOKIE);
  return Response.json({ ok: true });
}
