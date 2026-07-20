/**
 * Resolve the signed-in customer's CANONICAL `customer_id` from the request's
 * `ng_session` cookie (Milestone 2, Task T4 support).
 *
 * Server-only — imported from Node route handlers. The `ng_session` cookie is a
 * signed HMAC over the Firebase UID (see `@/lib/session`); a valid cookie proves
 * the bearer signed in as that UID. We map UID → canonical customer by:
 *   1. the stamped backlink on the live `public.users` row (`users.customer_id`,
 *      written by the sign-in route via `linkUserToCustomer`), or
 *   2. a best-effort `resolveCustomer` for the current identity when the
 *      backlink isn't present yet (e.g. a session minted before dedup existed).
 *
 * This is the SINGLE auth gate for the address-book API: every read/write scopes
 * strictly to the returned `customer_id`, so a caller can only ever see or touch
 * their own canonical customer's addresses.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NG_SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import {
  getCustomerByIdentity,
  resolveCustomer,
  type CustomerProvider,
} from "@/lib/customer-identity";
import { recordAttribution } from "@/lib/referrals";

/**
 * Best-effort referral attribution: when the caller carries an `ng_ref` cookie
 * (set by /r/<code>), tie this newly-resolved customer to the referrer. The
 * engine is idempotent (unique on referee) so repeated calls are cheap no-ops
 * once attributed. Never throws — attribution must never break the auth gate.
 */
async function maybeCaptureReferral(
  customerId: string,
  jar: Awaited<ReturnType<typeof cookies>>,
): Promise<void> {
  const code = jar.get("ng_ref")?.value;
  if (!code) return;
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const deviceHash = h.get("user-agent")?.slice(0, 200) ?? null;
    await recordAttribution({ refereeCustomerId: customerId, code, ip, deviceHash });
  } catch {
    /* best-effort */
  }
}

export interface ResolvedCustomerSession {
  /** Firebase UID embedded in the verified `ng_session` cookie. */
  uid: string;
  /** Canonical `public.customers.id` this signed-in user owns. */
  customerId: string;
}

/**
 * Verify the `ng_session` cookie and resolve the caller's canonical customer.
 *
 * Returns null when the cookie is missing/invalid (unauthenticated) or when the
 * canonical customer cannot be resolved (e.g. Supabase unconfigured). Never
 * throws — callers translate null into a 401.
 */
export async function getCustomerSession(): Promise<ResolvedCustomerSession | null> {
  const jar = await cookies();
  const uid = await verifySessionToken(jar.get(NG_SESSION_COOKIE)?.value);
  if (!uid) return null;

  try {
    // 1. Prefer the stamped backlink on the live `users` row.
    const { data: userRow } = await supabaseAdmin()
      .from("users")
      .select("customer_id, provider, email, phone")
      .eq("firebase_uid", uid)
      .maybeSingle();

    const linked = (userRow as { customer_id: string | null } | null)?.customer_id;
    if (linked) {
      await maybeCaptureReferral(linked, jar);
      return { uid, customerId: linked };
    }

    // 2. Best-effort: resolve (or create) the canonical customer for the
    //    current identity, then reuse it. Mirrors the link-phone fallback.
    const provider: CustomerProvider =
      (userRow as { provider?: string | null } | null)?.provider === "phone"
        ? "phone"
        : "google";

    const existing = await getCustomerByIdentity(provider, uid);
    if (existing) {
      await maybeCaptureReferral(existing.customer.id, jar);
      return { uid, customerId: existing.customer.id };
    }

    const resolved = await resolveCustomer({ provider, providerUid: uid });
    await maybeCaptureReferral(resolved.customer.id, jar);
    return { uid, customerId: resolved.customer.id };
  } catch {
    // Supabase unconfigured / transient error → treat as unresolved (401).
    return null;
  }
}
