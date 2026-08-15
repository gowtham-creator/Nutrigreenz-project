import { revalidatePath } from "next/cache";

/**
 * Bust the storefront's ISR cache after a catalogue write.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * Every catalogue-backed storefront page — home, /shop, each category, each
 * PDP, the search API — carries `revalidate = 60`. So a product published,
 * renamed, repriced, hidden, or marked out of stock in the admin took up to a
 * minute to reach a shopper, with no way for the operator to know whether it
 * had landed. Marketing already busted the cache explicitly on write
 * (promotions, announcements); the eleven inventory endpoints did not, so the
 * same product could be live in the admin and stale on the shop.
 *
 * The stock case is the one that actually costs money: for up to a minute
 * after an operator marks something out of stock, the storefront still offers
 * it and a customer can add it to their bag and pay for it.
 *
 * `revalidatePath("/", "layout")` invalidates every route under the root
 * layout in one call, which is what a catalogue change genuinely affects — a
 * product appears on the home rails, its category, its own page, search, and
 * the sitemap. Enumerating those paths per write would mean each new surface
 * silently missing the list.
 *
 * Deliberately swallows its own errors. Revalidation is a cache hint, not part
 * of the write: the row is already committed by the time this runs, and an
 * admin save must not report failure because a cache bust threw.
 */
export function revalidateStorefront(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    /* see above — the write already succeeded */
  }
}
