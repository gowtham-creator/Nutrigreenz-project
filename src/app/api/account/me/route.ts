import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerById } from "@/lib/customer-identity";

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

    return Response.json({
      ok: true,
      customer: {
        name: customer.displayName,
        email: customer.primaryEmail,
        phone: customer.primaryPhone,
      },
    });
  } catch {
    return Response.json({ ok: true, customer: null });
  }
}
