/**
 * GET /api/account/rewards — the signed-in customer's loyalty summary.
 *
 * Returns the live points balance (SUM of the append-only ledger) plus the 20
 * most recent ledger rows (newest first), scoped strictly to the canonical
 * `customer_id` resolved from the `ng_session` cookie via
 * {@link getCustomerSession}. This is the real backend behind the storefront's
 * Harvest-Coins wallet — replacing the hardcoded demo ledger. Best-effort:
 * returns an empty wallet when signed out / unconfigured.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import { loyaltyBalance, listLoyaltyLedger } from "@/lib/rewards";

// supabase-admin + jose (via the session) need the Node runtime.
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, balance: 0, ledger: [] });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const [balance, ledger] = await Promise.all([
    loyaltyBalance(session.customerId),
    listLoyaltyLedger(session.customerId, 20),
  ]);
  return Response.json({ ok: true, balance, ledger });
}
