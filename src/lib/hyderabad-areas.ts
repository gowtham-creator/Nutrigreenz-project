/**
 * Single source of truth for the Hyderabad delivery zones the storefront knows
 * about. Framework-agnostic (no React / no "use client") so it can be shared by
 * BOTH the client location context (`@/lib/location`) and server-side reverse
 * geocoding (`@/lib/geo-locate`) — the two must agree so that a GPS auto-detect
 * and a manually typed pincode resolve to the exact same area label.
 */

/**
 * Hyderabad pincodes we currently deliver to. Mocked here; the authoritative
 * serviceable list comes from the admin portal / logistics service later.
 */
export const SERVICEABLE_PINCODES: string[] = [
  "500081", // Madhapur / Hitech City
  "500032", // Gachibowli
  "500084", // Kondapur
  "500072", // Kukatpally (KPHB)
  "500085", // KPHB Colony
  "500034", // Banjara Hills
  "500033", // Jubilee Hills
  "500016", // Begumpet
  "500003", // Secunderabad
  "500049", // Miyapur
  "500089", // Manikonda
  "500074", // LB Nagar
  "500060", // Dilsukhnagar
];

/** Pincode → pretty area label for the known serviceable zones. */
export const AREA_BY_PINCODE: Record<string, string> = {
  "500081": "Madhapur",
  "500032": "Gachibowli",
  "500084": "Kondapur",
  "500072": "Kukatpally",
  "500085": "KPHB Colony",
  "500034": "Banjara Hills",
  "500033": "Jubilee Hills",
  "500016": "Begumpet",
  "500003": "Secunderabad",
  "500049": "Miyapur",
  "500089": "Manikonda",
  "500074": "LB Nagar",
  "500060": "Dilsukhnagar",
};

/**
 * Pretty area label for a KNOWN serviceable pincode, or `null` when we don't
 * have a curated label. Callers that want a display fallback layer their own
 * (e.g. a geocoder's locality name) on top of this.
 */
export function knownAreaForPincode(pincode: string): string | null {
  return AREA_BY_PINCODE[pincode.trim()] ?? null;
}

/** Pretty area label for a pincode, falling back to a generic "Hyderabad". */
export function lookupArea(pincode: string): string {
  return knownAreaForPincode(pincode) ?? "Hyderabad";
}

/** A Hyderabad delivery pincode (any `500xxx`, plus the curated popular list). */
export function isHyderabadPincode(pincode: string): boolean {
  const p = pincode.trim();
  return /^500\d{3}$/.test(p) || SERVICEABLE_PINCODES.includes(p);
}
