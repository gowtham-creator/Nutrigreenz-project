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

/** The place's own name: the first segment, as typed. */
export function communityName(full: string): string {
  return (
    full
      .split(",")
      .map((p) => p.trim())
      .find(Boolean) ?? ""
  );
}

/**
 * What two community records are compared on.
 *
 * Places gives the full address ("SAS Crown, Golden Mile Road, Kokapet, ...")
 * while the delivery list may hold just "SAS Crown". Compared whole they never
 * match, so a coupon picked from the map would refuse every customer in the
 * community it was made for. The stored values are left as they are; only the
 * comparison uses this.
 */
export function communityKey(full: string): string {
  return communityName(full).replace(/\s+/g, " ").toLowerCase();
}

/** Whether any of `candidates` is one of the `targeted` communities. */
export function matchesCommunity(
  targeted: readonly string[],
  candidates: readonly string[],
): boolean {
  const keys = new Set(targeted.map(communityKey).filter(Boolean));
  return candidates.some((c) => keys.has(communityKey(c)));
}

/** Lowercase words and single spaces, so punctuation can't hide or split a name. */
function words(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Whether a delivery address names one of the `targeted` communities.
 *
 * On whole words, because a loose substring would let "Green Park" match
 * "Evergreen Park Road". Compared as space-padded text rather than a RegExp built
 * from the name: community names are operator input, and "Sri Sai (Phase 2)" is
 * not a valid pattern.
 */
export function addressNamesCommunity(
  targeted: readonly string[],
  addressText: string | null | undefined,
): boolean {
  const address = ` ${words(addressText ?? "")} `;
  return targeted.some((community) => {
    const name = words(communityKey(community));
    return name.length > 0 && address.includes(` ${name} `);
  });
}

/**
 * The parts of an order's address snapshot that say where it is going.
 *
 * A named list, because the snapshot also holds the recipient: a customer called
 * Green Park must not qualify for a coupon meant for a society of that name. City
 * and state are left out for the same reason, since neither identifies a society
 * and both would match far too widely. The older key spellings are read too, as
 * the admin order list does, because snapshots are stored as they were sent.
 */
const ADDRESS_KEYS = [
  "line1",
  "line2",
  "landmark",
  "area",
  "locality",
  "region",
  "buildingFloorFlat",
  "roadStreet",
  "areaLandmark",
];

export function snapshotAddressText(
  snapshot: Record<string, unknown> | null | undefined,
): string {
  if (!snapshot) return "";
  return ADDRESS_KEYS.map((key) => snapshot[key])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");
}

/** A pincode list as typed in a form, with `pincode` added if it isn't there. */
export function withPincode(list: string, pincode: string): string {
  const pins = list
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set([...pins, pincode.trim()])).join(", ");
}

/** A one-line summary for a whole assignment, e.g. "3 communities · Kokapet +2". */
export function communitySummary(communities: readonly string[]): string {
  if (communities.length === 0) return "No communities assigned";
  if (communities.length === 1) return shortCommunity(communities[0]);
  return `${shortCommunity(communities[0])} +${communities.length - 1} more`;
}

/** "2026-11-05", "Evening (5–8 PM)" → "Thu, 5 Nov · Evening (5–8 PM)". */
export function deliveryWhenLabel(isoDay: string, windowText: string): string {
  const day = new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${day} · ${windowText}`;
}
