"use client";

/**
 * Shared, deduplicated reader for `/api/admin/me`.
 *
 * Why this exists: `AdminShell` is rendered by each admin PAGE rather than by
 * the admin layout, so it unmounts and remounts on every navigation. Two of its
 * children — the identity chip and the nav — each fetched `/api/admin/me`
 * independently from their own effect. That is two round-trips on every single
 * click through the portal, both of them hitting the session verify and a
 * Supabase read, and both blocking the sidebar from painting its real links.
 *
 * The answer barely changes within a session: it is the signed-in admin's own
 * profile and permission set. So it is fetched once, cached in module scope for
 * the life of the tab, and shared:
 *
 *   · concurrent callers join the SAME in-flight promise (dedupe), so the two
 *     components mounting together cost one request, not two;
 *   · later callers inside the TTL get the cached value with no request at all,
 *     which is what makes navigation feel instant instead of flickering.
 *
 * Cache correctness: permissions can be changed by a superadmin while someone is
 * signed in, so this must not be cached forever — the TTL bounds how long a
 * revoked grant keeps showing in the nav. It is only ever a UX cache; every
 * admin route independently enforces its own permission server-side, so a stale
 * nav item leads to a refusal, not to access. {@link invalidateAdminMe} clears
 * it immediately after a profile save.
 */

export interface AdminMeProfile {
  email: string;
  name: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: string;
}

export interface AdminMe {
  ok: boolean;
  profile: AdminMeProfile | null;
  permissions: string[];
}

/** Long enough to cover a burst of navigation, short enough that a revoked
 *  permission disappears from the nav within a minute. */
const TTL_MS = 60_000;

let cached: { at: number; data: AdminMe } | null = null;
let inflight: Promise<AdminMe | null> | null = null;
/** Bumped by every new request and by invalidation, so a request that finishes
 *  late can tell whether it is still the current one. */
let generation = 0;

/**
 * Read the current admin's profile + effective permissions.
 * Returns null when signed out or the request fails; callers fall back to their
 * own safe defaults rather than blocking on it.
 */
export async function fetchAdminMe(options?: { force?: boolean }): Promise<AdminMe | null> {
  if (options?.force) {
    cached = null;
    inflight = null;
  } else {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
    // A request is already on its way — join it instead of starting a second.
    if (inflight) return inflight;
  }

  const gen = ++generation;
  const request = (async (): Promise<AdminMe | null> => {
    try {
      const res = await fetch("/api/admin/me", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as AdminMe;
      // Only publish to the cache if nothing has superseded this request —
      // otherwise a slow response could overwrite a fresher one.
      if (gen === generation) cached = { at: Date.now(), data };
      return data;
    } catch {
      return null;
    } finally {
      // Clear the slot only if we are still the current request, so a refresh
      // started meanwhile isn't dropped by this one finishing late.
      if (gen === generation) inflight = null;
    }
  })();

  inflight = request;
  return request;
}

/** Drop the cache — call after anything that changes the profile or grants. */
export function invalidateAdminMe(): void {
  cached = null;
  inflight = null;
  generation++;
}
