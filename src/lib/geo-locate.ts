/**
 * Server-side reverse geocoding for the storefront "Deliver to" auto-detect.
 *
 * WHY SERVER-SIDE: the browser's free geocoders are inaccurate for India. The
 * previous client call to BigDataCloud's `reverse-geocode-client` returned the
 * administrative *mandal* as `locality` (a GPS fix in Miyapur came back as
 * "Serilingampally") and an EMPTY `postcode`, so the pill showed the wrong area
 * and no pincode. OpenStreetMap's Nominatim returns a proper suburb-level
 * locality AND the postcode for the same point, but its usage policy wants a
 * descriptive `User-Agent` — which a browser cannot set. Doing it here lets us
 * set that header, apply a short timeout, and keep one geocoder swap-point.
 *
 * ACCURACY CONTRACT: we derive the pincode from the coordinates and run it
 * through the SAME `knownAreaForPincode` lookup that manual pincode entry uses,
 * so auto-detect and typing a pincode resolve to the identical area label. The
 * geocoder's own locality name is only a fallback for pincodes we don't curate.
 *
 * Server-only — imported from Node route handlers (never client/Edge).
 */
import "server-only";
import { knownAreaForPincode } from "@/lib/hyderabad-areas";

/** A normalized reverse-geocode result. */
export interface GeoLocation {
  /** Human area/locality label (curated when the pincode is known). */
  area: string;
  /** 6-digit Indian pincode, or "" when the geocoder couldn't resolve one. */
  pincode: string;
  /** City/town, defaulting caller-side to "Hyderabad". */
  city: string;
}

/** Raw parts a single geocoder can contribute before normalization. */
interface GeoParts {
  pincode: string;
  locality: string;
  city: string;
}

const NG_USER_AGENT = "NutriGreenz/1.0 (storefront delivery locator)";
const GEOCODE_TIMEOUT_MS = 6000;

/** Normalize any postcode string to a bare 6-digit Indian pincode, or "". */
function normalizePincode(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 6 ? digits : "";
}

/**
 * OpenStreetMap Nominatim — accurate suburb + postcode for India. Honours the
 * public usage policy (descriptive User-Agent, single low-volume request).
 */
async function fromNominatim(lat: number, lng: number): Promise<GeoParts | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
    `&format=jsonv2&addressdetails=1&zoom=18`;
  const res = await fetch(url, {
    headers: { "User-Agent": NG_USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    address?: Record<string, string | undefined>;
  };
  const a = json.address ?? {};
  // Prefer the most specific *residential* locality; deliberately skip `county`
  // / `state_district` which carry the mandal/revenue-division names.
  const locality =
    a.neighbourhood ||
    a.suburb ||
    a.quarter ||
    a.residential ||
    a.village ||
    a.town ||
    a.city_district ||
    a.municipality ||
    "";
  const city = a.city || a.town || a.municipality || a.state_district || "";
  return { pincode: normalizePincode(a.postcode), locality, city };
}

/**
 * BigDataCloud fallback — used only when Nominatim is unreachable. Its `locality`
 * is the administrative mandal for India (less accurate) and its free tier often
 * omits the postcode, so it is intentionally the LAST resort.
 */
async function fromBigDataCloud(lat: number, lng: number): Promise<GeoParts | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
  if (!res.ok) return null;
  const d = (await res.json()) as {
    locality?: string;
    city?: string;
    principalSubdivision?: string;
    postcode?: string;
  };
  return {
    pincode: normalizePincode(d.postcode),
    locality: d.locality || d.city || d.principalSubdivision || "",
    city: d.city || d.principalSubdivision || "",
  };
}

/** Run a geocoder, swallowing network/parse/timeout errors into `null`. */
async function safe(fn: () => Promise<GeoParts | null>): Promise<GeoParts | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode coordinates to `{ area, pincode, city }`, or `null` when every
 * provider fails (the caller then falls back to its own deterministic mock).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoLocation | null> {
  let parts = await safe(() => fromNominatim(lat, lng));
  if (!parts || (!parts.pincode && !parts.locality)) {
    parts = (await safe(() => fromBigDataCloud(lat, lng))) ?? parts;
  }
  if (!parts) return null;

  const pincode = parts.pincode;
  // Curated label wins so auto-detect matches manual pincode entry exactly;
  // otherwise fall back to the geocoder's own locality/city.
  const area =
    (pincode ? knownAreaForPincode(pincode) : null) ||
    parts.locality ||
    parts.city ||
    "Current location";

  if (!pincode && area === "Current location") return null;
  return { area, pincode, city: parts.city || "Hyderabad" };
}
