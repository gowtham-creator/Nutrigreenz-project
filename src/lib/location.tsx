"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LocationZone } from "@/types/nutrigreenz";
import {
  SERVICEABLE_PINCODES,
  lookupArea,
} from "@/lib/hyderabad-areas";
import {
  isValidIndianPincode,
  resolveOffline,
  stateForPincode,
} from "@/lib/india-pincodes";
import { markLocationOnboarded } from "@/lib/location-onboarding-flag";

const STORAGE_KEY = "ng.location.v1";

// The serviceable list + pincode→area lookup now live in the framework-agnostic
// `@/lib/hyderabad-areas` so the server-side reverse geocoder shares them. Keep
// re-exporting here so existing importers of `@/lib/location` are unaffected.
export { SERVICEABLE_PINCODES, lookupArea };

interface LocationContextValue {
  /** The currently selected delivery zone, or null if none chosen yet. */
  zone: LocationZone | null;
  /** Set the active delivery zone (persisted to localStorage). */
  setZone: (zone: LocationZone | null) => void;
  /** Ask the browser for geolocation, then resolve it to a real Indian area. */
  requestBrowserLocation: () => Promise<void>;
  /**
   * Whether a pincode is SYNTACTICALLY a real Indian pincode.
   *
   * Renamed in meaning from the old Hyderabad-only gate: this no longer says
   * anything about delivery. Use {@link resolvePincode} for that — conflating
   * the two is what made every non-Hyderabad pincode look like a typo.
   */
  isValidPincode: (pincode: string) => boolean;
  /** Recognise any Indian pincode and report whether we deliver there. */
  resolvePincode: (pincode: string) => Promise<PincodeResult | null>;
  /** The full list of curated quick-pick pincodes. */
  serviceablePincodes: string[];
  /**
   * False until the stored zone has been read from localStorage.
   *
   * Consumers MUST wait for this before concluding no zone is set. Without it,
   * every child sees `zone === null` on first render — child effects run before
   * the provider's own hydration effect — which is precisely how the onboarding
   * modal came to re-prompt customers who had already chosen a location.
   */
  hydrated: boolean;
}

/** A recognised pincode plus the independent question of whether we deliver. */
export interface PincodeResult {
  area: string;
  district: string;
  state: string;
  pincode: string;
  serviceable: boolean;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function readStoredZone(): LocationZone | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as LocationZone).area === "string" &&
      typeof (parsed as LocationZone).pincode === "string"
    ) {
      return parsed as LocationZone;
    }
    return null;
  } catch {
    return null;
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneState] = useState<LocationZone | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setZoneState(readStoredZone());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      if (zone) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(zone));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* quota / private-mode — fail silently */
    }
  }, [zone, hydrated]);

  /*
   * Choosing a zone marks the browser onboarded, here rather than at each call
   * site. The change-location sheet previously set a zone without setting the
   * flag, so the first-visit modal re-opened on the next load for a customer
   * who had plainly already chosen — the double prompt. Putting it in the one
   * function every path goes through means no future caller can forget it.
   *
   * Clearing the zone (`null`) deliberately does NOT clear the flag: that is an
   * explicit "somewhere else" action, not a request to be asked again.
   */
  const setZone = useCallback((next: LocationZone | null) => {
    setZoneState(next);
    if (next) markLocationOnboarded();
  }, []);

  const isValidPincode = useCallback((pincode: string) => isValidIndianPincode(pincode), []);

  /*
   * Recognise a pincode anywhere in India, and separately report whether we
   * deliver there.
   *
   * This replaces a synchronous `isHyderabadPincode()` gate that returned false
   * for ~19,000 of India's ~19,100 pincodes, which the UI then rendered as
   * "invalid" — indistinguishable from a typo. The round trip is the cost of
   * being able to say "Andheri East, Mumbai — we don't deliver there yet"
   * instead of silently refusing to accept the input.
   *
   * Returns null only when the pincode is not a valid Indian one, so callers
   * can treat null as "keep typing" rather than as an error.
   */
  const resolvePincode = useCallback(
    async (pincode: string): Promise<PincodeResult | null> => {
      const pin = pincode.trim();
      if (!isValidIndianPincode(pin)) return null;

      // Offline first: a real label immediately, refined by the response below.
      const offline = resolveOffline(pin);
      try {
        const res = await fetch(`/api/geo/pincode?pincode=${pin}`, { cache: "force-cache" });
        if (res.ok) {
          const d = (await res.json()) as {
            ok?: boolean;
            location?: { area?: string; district?: string; state?: string };
            serviceable?: boolean;
          };
          if (d?.ok && d.location) {
            return {
              area: d.location.area || offline?.area || "",
              district: d.location.district || "",
              state: d.location.state || offline?.state || "",
              pincode: pin,
              serviceable: d.serviceable === true,
            };
          }
        }
      } catch {
        /* fall through to the offline label */
      }
      // Upstream unreachable: still recognise the pincode, but do not claim we
      // deliver there. Guessing "serviceable" would take an order we cannot fill.
      return offline
        ? { ...offline, serviceable: false }
        : null;
    },
    [],
  );

  const requestBrowserLocation = useCallback(async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation isn't available in this browser.");
    }
    /*
     * Coarse fix, deliberately.
     *
     * `enableHighAccuracy: true` asks for a GPS-grade fix. Indoors, or on a
     * desktop with no GPS radio, that routinely spent most of the 15s budget
     * before falling back to the same wifi/IP estimate a coarse request returns
     * in under a second — which is what made "Detect" feel broken. We are
     * resolving to a PINCODE, an area of several square kilometres, so metre
     * accuracy buys nothing and costs the entire perceived latency of the flow.
     */
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 300_000,
      });
    });
    const { latitude, longitude } = position.coords;
    // Resolve area + pincode server-side (`/api/geo/detect`): it reverse-geocodes
    // the coordinates, derives the pincode, and runs it through the SAME
    // pincode→area lookup that manual entry uses — so auto-detect and typing a
    // pincode always agree. The endpoint also best-effort persists the hint for a
    // signed-in customer with no saved address. Falls back to the deterministic
    // mock when it's unreachable so the UI never blocks.
    try {
      const res = await fetch("/api/geo/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });
      const d = (res.ok ? await res.json() : null) as
        | { ok?: boolean; area?: string; pincode?: string; city?: string }
        | null;
      if (d?.ok && (d.pincode || d.area)) {
        const pincode = d.pincode ?? "";
        // Via setZoneState + the flag directly, mirroring `setZone` — a
        // successful GPS detect is just as much "the customer has chosen" as
        // typing a pincode, and must not leave the browser un-onboarded.
        markLocationOnboarded();
        setZoneState({
          area: d.area || lookupArea(pincode),
          pincode,
          // No Hyderabad default: a customer in Pune must not be labelled
          // Hyderabad because the geocoder omitted a city. Fall back to the
          // state derived from the pincode itself, which is always correct.
          city: d.city || stateForPincode(pincode) || "",
          lat: latitude,
          lng: longitude,
        });
        return;
      }
      throw new Error("reverse-geocode failed");
    } catch {
      /*
       * Reverse geocoding failed. The previous behaviour called
       * `mockReverseGeocode`, which derived a pseudo-random HYDERABAD pincode
       * from the coordinates — so a customer in Delhi was silently assigned a
       * Hyderabad zone and shown products they could not receive.
       *
       * Failing visibly is the correct behaviour: throw, and let the caller
       * offer manual pincode entry. A wrong location is worse than none.
       */
      throw new Error("Couldn't resolve your location.");
    }
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      zone,
      setZone,
      requestBrowserLocation,
      isValidPincode,
      resolvePincode,
      serviceablePincodes: SERVICEABLE_PINCODES,
      hydrated,
    }),
    [zone, setZone, requestBrowserLocation, isValidPincode, resolvePincode, hydrated],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Access the delivery location: zone + setters + serviceability helpers. */
export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within a <LocationProvider>");
  return ctx;
}
