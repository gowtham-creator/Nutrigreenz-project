/**
 * All-India pincode recognition.
 *
 * ── The distinction this file exists to draw ──────────────────────────────
 *
 * RECOGNITION and SERVICEABILITY are different questions, and conflating them
 * is what made the storefront look broken outside Hyderabad. Previously a
 * pincode we did not deliver to was simply not recognised: the label stayed
 * generic, the submit button never enabled, and the customer had no way to tell
 * whether they had mistyped or whether we just do not deliver there yet.
 *
 *   recognise(pincode)  → "this is Andheri East, Mumbai, Maharashtra"
 *   isServiceable(pin)  → "…but we do not deliver there yet"
 *
 * The first is a fact about India and is true everywhere. The second is a
 * business decision owned by the Super Admin `serviceable_areas` list. A
 * customer in Mumbai should see their real area name AND an honest "not yet"
 * rather than a dead form.
 *
 * ── Why the postal-circle table ───────────────────────────────────────────
 *
 * Indian pincodes are hierarchical: the first digit is the postal region, and
 * the first two the circle. That alone identifies the state for any valid
 * pincode with no network call at all, which means we can label a pincode
 * instantly and correct the "unknown place" feel even when the lookup below is
 * slow or unreachable. The API then refines it to the actual locality.
 *
 * Framework-agnostic (no React, no server-only) so the client context and the
 * server geocoder can share it, exactly as `hyderabad-areas` did.
 */

/** A resolved Indian pincode. `area` is the finest label we could obtain. */
export interface PincodeLocation {
  pincode: string;
  /** Locality / post-office name, or the district when that is all we have. */
  area: string;
  district: string;
  state: string;
  /**
   * Every locality sharing this pincode, when known.
   *
   * A pincode is an AREA, not a point — 110001 covers 21 post offices — and
   * the customer may recognise the third name rather than the first, so the
   * full set is carried through for the UI to show.
   */
  localities?: string[];
}

/**
 * Pincode prefix → state or union territory.
 *
 * ── This is the OFFLINE FALLBACK, not the source of truth ─────────────────
 *
 * The authoritative answer comes from India Post via `/api/geo/pincode`, which
 * covers every allocated pincode in the country and returns the actual
 * locality. This table exists for two narrower jobs: labelling the input the
 * instant six digits are typed, before the round trip returns, and degrading
 * to something true rather than nothing when that API is unreachable.
 *
 * ── Why some keys are three digits ────────────────────────────────────────
 *
 * Two digits is not enough. Prefix 79 alone spans Arunachal Pradesh,
 * Meghalaya, Manipur, Mizoram, Nagaland and Tripura; 73 covers both West
 * Bengal and Sikkim; 60 covers Tamil Nadu and Puducherry; 74 covers West
 * Bengal and the Andaman & Nicobar Islands. Those ranges are keyed at three
 * digits and looked up first, so a customer in Shillong is not told they are
 * in Arunachal Pradesh.
 *
 * ── Where these values came from ──────────────────────────────────────────
 *
 * Every entry was resolved by querying India Post directly for real pincodes
 * in each range, rather than written from memory. Names are spelled as that
 * API spells them, so the offline label and the online one agree — it returns
 * "Pondicherry" rather than "Puducherry", and that consistency matters more
 * here than the current official name.
 */

/**
 * Checked FIRST, ahead of everything else.
 *
 * Lakshadweep has no prefix of its own: it is carved out of Kerala's 682,
 * which is otherwise Kochi. 682551–682559 is the islands, 682001 is the
 * mainland. Nothing shorter than five digits can tell them apart.
 */
const STATE_BY_PREFIX5: Record<string, string> = {
  68255: "Lakshadweep",
  // Daman & Diu and Dadra & Nagar Haveli sit side by side inside Gujarat's
  // 396, and they share the first FOUR digits — 396210 is Daman, 396240 is
  // Silvassa, 396230 is Gujarat proper. Only five digits separates them.
  39621: "Daman & Diu",
  39622: "Daman & Diu",
  39624: "Dadra & Nagar Haveli",
};

/**
 * Four-digit exceptions, checked after the five-digit table.
 *
 * 246 is Uttarakhand except for its 2467xx block, which is Uttar Pradesh
 * (Bijnor district). A three-digit key alone reports Bijnor as Uttarakhand.
 */
const STATE_BY_PREFIX4: Record<string, string> = {
  2467: "Uttar Pradesh",
};

/** Checked second. For ranges a two-digit key gets wrong. */
const STATE_BY_PREFIX3: Record<string, string> = {
  // Uttarakhand, carved out of UP's 24x/26x. 247 is still UP (Saharanpur),
  // which is why this cannot be a simple range.
  246: "Uttarakhand", 248: "Uttarakhand", 249: "Uttarakhand",
  263: "Uttarakhand",
  // Diu, which India Post files under 362 (otherwise Gujarat's Junagadh).
  362: "Daman & Diu",
  // Tamil Nadu vs Puducherry
  605: "Pondicherry",
  // West Bengal vs Sikkim vs Andaman & Nicobar
  737: "Sikkim",
  744: "Andaman & Nicobar",
  // The north-east: six states share prefix 79
  790: "Arunachal Pradesh", 791: "Arunachal Pradesh", 792: "Arunachal Pradesh",
  793: "Meghalaya", 794: "Meghalaya",
  795: "Manipur",
  796: "Mizoram",
  797: "Nagaland",
  799: "Tripura",
};

/** The common case. */
const STATE_BY_PREFIX: Record<string, string> = {
  11: "Delhi",
  12: "Haryana", 13: "Haryana",
  14: "Punjab", 15: "Punjab",
  16: "Chandigarh",
  17: "Himachal Pradesh",
  18: "Jammu & Kashmir", 19: "Jammu & Kashmir",
  20: "Uttar Pradesh", 21: "Uttar Pradesh", 22: "Uttar Pradesh",
  23: "Uttar Pradesh", 24: "Uttar Pradesh", 25: "Uttar Pradesh",
  26: "Uttar Pradesh", 27: "Uttar Pradesh", 28: "Uttar Pradesh",
  30: "Rajasthan", 31: "Rajasthan", 32: "Rajasthan", 33: "Rajasthan",
  34: "Rajasthan",
  36: "Gujarat", 37: "Gujarat", 38: "Gujarat", 39: "Gujarat",
  40: "Maharashtra", 41: "Maharashtra", 42: "Maharashtra",
  43: "Maharashtra", 44: "Maharashtra",
  45: "Madhya Pradesh", 46: "Madhya Pradesh", 47: "Madhya Pradesh",
  48: "Madhya Pradesh",
  49: "Chattisgarh",
  50: "Telangana",
  51: "Andhra Pradesh", 52: "Andhra Pradesh", 53: "Andhra Pradesh",
  56: "Karnataka", 57: "Karnataka", 58: "Karnataka", 59: "Karnataka",
  60: "Tamil Nadu", 61: "Tamil Nadu", 62: "Tamil Nadu", 63: "Tamil Nadu",
  64: "Tamil Nadu",
  67: "Kerala", 68: "Kerala", 69: "Kerala",
  70: "West Bengal", 71: "West Bengal", 72: "West Bengal", 73: "West Bengal",
  74: "West Bengal",
  75: "Odisha", 76: "Odisha", 77: "Odisha",
  78: "Assam",
  79: "Arunachal Pradesh",
  80: "Bihar", 81: "Bihar", 82: "Bihar", 83: "Jharkhand", 84: "Bihar",
  85: "Bihar",
};

/**
 * A syntactically valid Indian pincode.
 *
 * Six digits, and the first may not be 0 or 9 — no postal region uses either,
 * so `000000` and `999999` are rejected here rather than sent to the API.
 */
export function isValidIndianPincode(pincode: string): boolean {
  return /^[1-8]\d{5}$/.test(pincode.trim());
}

/**
 * Best-effort state for a pincode with no network call. Never throws.
 *
 * Longest prefix wins: the finer tables exist precisely to override a coarser
 * answer that would be wrong, so they are consulted first.
 */
export function stateForPincode(pincode: string): string {
  const pin = pincode.trim();
  if (!isValidIndianPincode(pin)) return "";
  return (
    STATE_BY_PREFIX5[pin.slice(0, 5)] ??
    STATE_BY_PREFIX4[pin.slice(0, 4)] ??
    STATE_BY_PREFIX3[pin.slice(0, 3)] ??
    STATE_BY_PREFIX[pin.slice(0, 2)] ??
    "India"
  );
}

/**
 * Immediate, offline resolution. Always returns something for a valid pincode,
 * so the UI can label the input on the keystroke that completes it rather than
 * waiting on a round trip.
 */
export function resolveOffline(pincode: string): PincodeLocation | null {
  const pin = pincode.trim();
  if (!isValidIndianPincode(pin)) return null;
  const state = stateForPincode(pin);
  return { pincode: pin, area: state, district: "", state };
}
