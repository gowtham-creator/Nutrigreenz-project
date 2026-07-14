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
  AREA_BY_PINCODE,
  SERVICEABLE_PINCODES,
  isHyderabadPincode,
  lookupArea,
} from "@/lib/hyderabad-areas";

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
  /** Ask the browser for geolocation, then mock-resolve to a Hyderabad area. */
  requestBrowserLocation: () => Promise<void>;
  /** Whether a pincode is in the serviceable list. */
  isServiceable: (pincode: string) => boolean;
  /** The full list of serviceable pincodes. */
  serviceablePincodes: string[];
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

/**
 * Mock reverse-geocode: pick a Hyderabad zone from coordinates. Deterministic so
 * the same coords map to the same area; replace with a real geocoder later.
 */
function mockReverseGeocode(lat: number, lng: number): LocationZone {
  const pincode = SERVICEABLE_PINCODES[Math.abs(Math.round((lat + lng) * 1000)) % SERVICEABLE_PINCODES.length];
  return {
    area: AREA_BY_PINCODE[pincode] ?? "Hyderabad",
    pincode,
    city: "Hyderabad",
    lat,
    lng,
  };
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

  const setZone = useCallback((next: LocationZone | null) => setZoneState(next), []);

  const isServiceable = useCallback((pincode: string) => {
    // We deliver across Hyderabad — any 500xxx pincode is serviceable, plus the
    // explicit popular-areas list (kept for labels / quick-pick).
    return isHyderabadPincode(pincode);
  }, []);

  const requestBrowserLocation = useCallback(async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation isn't available in this browser.");
    }
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 60_000,
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
        setZoneState({
          area: d.area || lookupArea(pincode),
          pincode,
          city: d.city || "Hyderabad",
          lat: latitude,
          lng: longitude,
        });
        return;
      }
      throw new Error("reverse-geocode failed");
    } catch {
      setZoneState(mockReverseGeocode(latitude, longitude));
    }
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      zone,
      setZone,
      requestBrowserLocation,
      isServiceable,
      serviceablePincodes: SERVICEABLE_PINCODES,
    }),
    [zone, setZone, requestBrowserLocation, isServiceable],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Access the delivery location: zone + setters + serviceability helpers. */
export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within a <LocationProvider>");
  return ctx;
}
