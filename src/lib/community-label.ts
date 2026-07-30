/**
 * Display helpers for assigned-community names.
 *
 * Communities are stored as whatever Google Places returned when the operator
 * picked one, which is the full formatted address:
 *
 *   "SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana, India"
 *
 * That is the right thing to STORE — it disambiguates places with the same name
 * and keeps the record matchable against an address later. It is the wrong thing
 * to PRINT in a chip: at 65 characters it wrapped onto four lines and turned the
 * pill into a block of text. The tail is also pure noise, because every row
 * repeats the same city, state and country.
 *
 * So the stored value is left alone and only the display is shortened. The full
 * string still goes in the element's `title`, so nothing is actually hidden.
 */

/** Segments that never help identify a community and only add width. */
const NOISE = /^(india|bharat)$/i;

/**
 * "SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana, India"
 *   → "SAS Crown · Kokapet"
 *
 * The first segment is the place itself. The locality is taken from just before
 * the state, which is where Places consistently puts it — that is the part that
 * actually distinguishes two communities sharing a name.
 */
export function shortCommunity(full: string): string {
  const parts = full
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !NOISE.test(p));

  if (parts.length === 0) return full.trim();

  const head = parts[0];
  if (parts.length === 1) return head;

  // [place, road, locality, city, state] — the locality sits third from the end
  // once the country is stripped. Shorter addresses fall back to the next part.
  const locality = parts.length >= 3 ? parts[parts.length - 3] : parts[1];

  if (!locality || locality.toLowerCase() === head.toLowerCase()) return head;
  return `${head} · ${locality}`;
}

/** A one-line summary for a whole assignment, e.g. "3 communities · Kokapet +2". */
export function communitySummary(communities: readonly string[]): string {
  if (communities.length === 0) return "No communities assigned";
  if (communities.length === 1) return shortCommunity(communities[0]);
  return `${shortCommunity(communities[0])} +${communities.length - 1} more`;
}
