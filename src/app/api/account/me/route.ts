import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerById } from "@/lib/customer-identity";
import {
  getCustomerProfile,
  updateCustomerProfile,
  ProfileValidationError,
  type CustomerProfilePatch,
} from "@/lib/customer-profile";

// supabase-admin + jose (via the session) need the Node runtime.
export const runtime = "nodejs";

/**
 * GET /api/account/me — the signed-in customer's CANONICAL profile.
 *
 * Reads name / email / phone from the canonical `public.customers` row (resolved
 * from the `ng_session` cookie via {@link getCustomerSession}). This is where a
 * phone merged in through the link-phone flow lives — the Firebase user object
 * never reflects it — so a Google session can finally surface its verified
 * mobile. Best-effort: returns `{ customer: null }` when signed out / unconfigured.
 */
export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, customer: null });
  }
  try {
    const session = await getCustomerSession();
    if (!session) return Response.json({ ok: true, customer: null });

    const customer = await getCustomerById(session.customerId);
    if (!customer) return Response.json({ ok: true, customer: null });

    // The profile row carries the same name/email/phone plus the fields the
    // account page edits, so one read serves the whole page.
    const profile = await getCustomerProfile(session.customerId);

    return Response.json({
      ok: true,
      customer: {
        name: customer.displayName,
        email: customer.primaryEmail,
        phone: customer.primaryPhone,
        dob: profile?.dob ?? null,
        gender: profile?.gender ?? null,
        dietPrefs: profile?.dietPrefs ?? [],
        notify: profile?.notify ?? { email: true, sms: true, whatsapp: true, orders: true },
      },
    });
  } catch {
    return Response.json({ ok: true, customer: null });
  }
}

/**
 * PATCH /api/account/me — save the profile fields the account page edits.
 *
 * Partial by design: the body carries only what changed, so a form that renders
 * a subset of the fields cannot blank the rest by omitting them.
 *
 * Phone is NOT editable here. It changes only through the OTP flow, because the
 * whole value of the number on this record is that it has been verified —
 * letting it be set by a PATCH would silently turn a verified phone into an
 * unverified one that still looks verified everywhere it is displayed.
 */
export async function PATCH(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "not-configured" }, { status: 503 });
  }

  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: CustomerProfilePatch;
  try {
    body = (await request.json()) as CustomerProfilePatch;
  } catch {
    return Response.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  try {
    const profile = await updateCustomerProfile(session.customerId, {
      name: body.name,
      email: body.email,
      dob: body.dob,
      gender: body.gender,
      dietPrefs: body.dietPrefs,
      notify: body.notify,
    });
    return Response.json({ ok: true, customer: profile });
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      // 422 rather than 400: the request was well-formed, one value was not.
      return Response.json(
        { ok: false, field: err.field, error: err.message },
        { status: 422 },
      );
    }
    return Response.json(
      { ok: false, error: "Could not save your profile. Please try again." },
      { status: 500 },
    );
  }
}
