"use client";

/**
 * Shared, deduplicated reader for `/api/admin/marketing/coupons`.
 *
 * Why this exists: the Super Admin config page mounts BOTH the coupon campaign
 * builder and the live-coupons panel at once, and each fetched the full coupon
 * list from its own effect on mount. Same URL, same data, twice, on every load
 * of that page — one of the 37 requests it fires, and a race besides: whichever
 * response landed second decided what both panels showed.
 *
 * Same shape as {@link fetchAdminMe}: concurrent callers join one in-flight
 * promise, and callers inside the TTL get the cached list with no request at
 * all. The TTL is deliberately short — coupons are edited on this very page, so
 * a stale list is a live correctness problem rather than a cosmetic one, and
 * every mutation calls {@link invalidateAdminCoupons} anyway.
 */

export interface AdminCoupon {
  id: string;
  code: string;
  active: boolean;
  [key: string]: unknown;
}

interface CouponsResponse {
  ok?: boolean;
  coupons?: AdminCoupon[];
}

/** Short: this list is mutated from the same screen that reads it. */
const TTL_MS = 10_000;

let cached: { at: number; data: CouponsResponse } | null = null;
let inflight: Promise<CouponsResponse | null> | null = null;
/** Bumped per request and on invalidation, so a late response can tell whether
 *  it is still the current one before publishing to the cache. */
let generation = 0;

/**
 * Read the coupon list. Returns null on failure; callers keep their own empty
 * state rather than blocking on it.
 */
export async function fetchAdminCoupons(options?: {
  force?: boolean;
}): Promise<CouponsResponse | null> {
  if (options?.force) {
    cached = null;
    inflight = null;
  } else {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
    if (inflight) return inflight;
  }

  const gen = ++generation;
  const request = (async (): Promise<CouponsResponse | null> => {
    try {
      const res = await fetch("/api/admin/marketing/coupons", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as CouponsResponse;
      if (gen === generation) cached = { at: Date.now(), data };
      return data;
    } catch {
      return null;
    } finally {
      if (gen === generation) inflight = null;
    }
  })();

  inflight = request;
  return request;
}

/** Drop the cache after any coupon write, so the next read is authoritative. */
export function invalidateAdminCoupons(): void {
  cached = null;
  inflight = null;
  generation++;
}
