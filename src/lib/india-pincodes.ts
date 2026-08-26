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
}

/**
 * Pincode prefix → state, derived from India Post's numbering plan.
 *
 * Keyed by the first TWO digits because several regions span states (region 5
 * covers both Andhra Pradesh and Karnataka, for instance). Lookup falls back to
 * the single-digit region when a two-digit key is absent, so every valid
 * pincode resolves to at least a state.
 */
const STATE_BY_PREFIX: Record<string, string> = {
  11: "Delhi",
  12: "Haryana", 13: "Haryana",
  14: "Punjab", 15: "Punjab", 16: "Punjab",
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
  49: "Chhattisgarh",
  50: "Telangana", 51: "Telangana",
  52: "Andhra Pradesh", 53: "Andhra Pradesh",
  56: "Karnataka", 57: "Karnataka", 58: "Karnataka", 59: "Karnataka",
  60: "Tamil Nadu", 61: "Tamil Nadu", 62: "Tamil Nadu", 63: "Tamil Nadu",
  64: "Tamil Nadu",
  66: "Tamil Nadu",
  67: "Kerala", 68: "Kerala", 69: "Kerala",
  70: "West Bengal", 71: "West Bengal", 72: "West Bengal", 73: "West Bengal",
  74: "West Bengal",
  75: "Odisha", 76: "Odisha", 77: "Odisha",
  78: "Assam",
  79: "Arunachal Pradesh",
  80: "Bihar", 81: "Bihar", 82: "Bihar", 83: "Jharkhand", 84: "Bihar",
  85: "Bihar",
};

/** Single-digit region fallback, for prefixes absent from the table above. */
const STATE_BY_REGION: Record<string, string> = {
  1: "North India",
  2: "Uttar Pradesh / Uttarakhand",
  3: "Rajasthan / Gujarat",
  4: "Maharashtra / Madhya Pradesh",
  5: "South India",
  6: "Tamil Nadu / Kerala",
  7: "East India",
  8: "Bihar / Jharkhand",
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

/** Best-effort state for a pincode with no network call. Never throws. */
export function stateForPincode(pincode: string): string {
  const pin = pincode.trim();
  if (!isValidIndianPincode(pin)) return "";
  return STATE_BY_PREFIX[pin.slice(0, 2)] ?? STATE_BY_REGION[pin.slice(0, 1)] ?? "India";
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
