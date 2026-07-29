"use client";

/**
 * Google Places (New) address autocomplete — cost-optimised client.
 *
 * Billing shape (per Google session pricing): the autocomplete keystrokes are
 * FREE inside a session; the single Place Details call that ends the session is
 * billed as Place Details **Essentials** because the field mask below requests
 * ONLY Essentials fields (addressComponents + formattedAddress). Both SKUs
 * carry a 10,000-events/month free tier, so the address search costs nothing
 * until ~10k address saves a month.
 *
 * The whole feature is OPTIONAL: when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not
 * configured the form simply renders without the search box.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export const isPlacesConfigured = KEY.length > 0;

export interface PlaceSuggestion {
  placeId: string;
  /** Full human-readable suggestion, e.g. "Road No. 12, Banjara Hills, Hyderabad". */
  text: string;
}

/** The parsed, form-ready parts of a picked place. */
export interface PlaceAddress {
  /** Premise / building / society name when Google knows it. */
  building: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
}

/** One token per search→pick cycle groups the keystrokes into a billing session. */
export function newSessionToken(): string {
  return crypto.randomUUID();
}

export async function autocompleteAddress(
  input: string,
  sessionToken: string,
  opts: {
    /**
     * Bias results toward the Hyderabad delivery area. On by default for the
     * customer address form, where local societies should outrank same-named
     * places elsewhere. Turn OFF for nationwide lookups (e.g. assigning a
     * captain to a community in another city) — a bias would bury real matches
     * outside Hyderabad.
     */
    biasHyderabad?: boolean;
  } = {},
): Promise<PlaceSuggestion[]> {
  if (!isPlacesConfigured || input.trim().length < 3) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": KEY,
      },
      body: JSON.stringify({
        input,
        sessionToken,
        includedRegionCodes: ["in"],
        languageCode: "en",
        ...(opts.biasHyderabad === false
          ? {}
          : {
              locationBias: {
                circle: {
                  center: { latitude: 17.4485, longitude: 78.3908 },
                  radius: 50000,
                },
              },
            }),
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: { placeId?: string; text?: { text?: string } };
      }>;
    };
    return (json.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        text: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.placeId && s.text);
  } catch {
    return [];
  }
}

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function pick(components: AddressComponent[], type: string): string {
  return (
    components.find((c) => c.types?.includes(type))?.longText ?? ""
  ).trim();
}

/**
 * Ends the autocomplete session with an Essentials-only Place Details call and
 * maps Google's address components onto our form fields.
 */
export async function fetchPlaceAddress(
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddress | null> {
  if (!isPlacesConfigured) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          "X-Goog-Api-Key": KEY,
          // Essentials-only mask — keeps the call in the cheapest Details SKU.
          "X-Goog-FieldMask": "addressComponents,formattedAddress",
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { addressComponents?: AddressComponent[] };
    const c = json.addressComponents ?? [];
    const building = [pick(c, "subpremise"), pick(c, "premise")]
      .filter(Boolean)
      .join(", ");
    const street = [pick(c, "street_number"), pick(c, "route")]
      .filter(Boolean)
      .join(", ");
    const area = [pick(c, "sublocality_level_2"), pick(c, "sublocality_level_1")]
      .filter(Boolean)
      .join(", ");
    return {
      building,
      street,
      area,
      city: pick(c, "locality") || pick(c, "administrative_area_level_3"),
      state: pick(c, "administrative_area_level_1"),
      pincode: pick(c, "postal_code"),
    };
  } catch {
    return null;
  }
}
