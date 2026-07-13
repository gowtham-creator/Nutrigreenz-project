/**
 * Client-side cache for the signed-in operator's avatar URL.
 *
 * Both the header identity chip (admin-shell) and the profile page read this on
 * mount so the avatar paints INSTANTLY instead of flashing the initial letter
 * while `/api/admin/me` is in flight. Kept in localStorage so it survives page
 * navigations + reloads; every accessor is best-effort (localStorage can throw
 * in private mode / when disabled), so callers always get a safe fallback.
 */

export const PHOTO_CACHE_KEY = "ng:admin-photo";

/** The cached avatar URL, or null when absent / unavailable. */
export function readCachedPhoto(): string | null {
  try {
    const v = localStorage.getItem(PHOTO_CACHE_KEY);
    // Never paint an object-URL preview from a previous session — it's dead.
    return v && !v.startsWith("blob:") ? v : null;
  } catch {
    return null;
  }
}

/** Store (or, when null, clear) the cached avatar URL. */
export function writeCachedPhoto(url: string | null): void {
  try {
    if (url && !url.startsWith("blob:")) localStorage.setItem(PHOTO_CACHE_KEY, url);
    else localStorage.removeItem(PHOTO_CACHE_KEY);
  } catch {
    /* ignore — the cache is a best-effort paint accelerator, not a source of truth */
  }
}
