"use client";

/**
 * Deduplicating GET for admin JSON endpoints, keyed by URL.
 *
 * The Super Admin config page mounts eight panels at once, and several of them
 * independently read the same endpoints from their own effects. Measured on one
 * load of that page: `config/commerce` four times, `config/commerce/slots` four
 * times, `config/loyalty` four times. Twelve requests where three would do,
 * every time the page opens, each one hitting the session verify and a Supabase
 * read before anything can paint.
 *
 * It is also a correctness problem, not only a speed one: four concurrent reads
 * of the same row can land in any order, so whichever resolved last decided
 * what its panel displayed.
 *
 * This is the same shape as `admin-me-client` and `admin-coupons-client`,
 * generalised over the URL: concurrent callers join one in-flight promise, and
 * callers inside the TTL get the cached body with no request at all.
 *
 * Deliberately GET-only and deliberately short-lived. These endpoints are
 * edited from the same screen that reads them, so the cache exists to collapse
 * a burst of mounts, not to hold data across a session. Any write should call
 * {@link invalidateAdminGet} for the paths it touched.
 */

/** Long enough to collapse a page's mount burst, short enough that an edit made
 *  on this screen is not read back stale. */
const TTL_MS = 8_000;

interface Entry {
  at: number;
  data: unknown;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
/** Per-URL generation, so a slow response cannot overwrite a fresher one. */
const generation = new Map<string, number>();

/**
 * Read an admin JSON endpoint, sharing the request with any concurrent caller.
 * Returns null when the request fails, so callers keep their own safe defaults
 * rather than blocking on it.
 */
export async function adminGet<T>(url: string, options?: { force?: boolean }): Promise<T | null> {
  if (options?.force) {
    cache.delete(url);
    inflight.delete(url);
  } else {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T | null>;
  }

  const gen = (generation.get(url) ?? 0) + 1;
  generation.set(url, gen);

  const request = (async (): Promise<T | null> => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      if (generation.get(url) === gen) cache.set(url, { at: Date.now(), data });
      return data;
    } catch {
      return null;
    } finally {
      if (generation.get(url) === gen) inflight.delete(url);
    }
  })();

  inflight.set(url, request);
  return request;
}

/**
 * Drop cached entries after a write. Pass a prefix to clear a family of paths
 * (e.g. "/api/admin/config/") or nothing to clear everything.
 */
export function invalidateAdminGet(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
  for (const key of [...inflight.keys()]) if (key.startsWith(prefix)) inflight.delete(key);
}
