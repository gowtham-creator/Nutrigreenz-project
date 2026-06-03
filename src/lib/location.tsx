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

const STORAGE_KEY = "ng.location.v1";

/**
 * Hyderabad pincodes we currently deliver to. Mocked here; the real serviceable
 * list comes from the admin portal / logistics service later.
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

/** Pincode → area label, used by the mock reverse-geocode. */
const AREA_BY_PINCODE: Record<string, string> = {
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

/** Pretty area label for a pincode (falls back to "Hyderabad"). Exported for onboarding/sheet. */
export function lookupArea(pincode: string): string {
  return AREA_BY_PINCODE[pincode.trim()] ?? "Hyderabad";
}

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
    const p = pincode.trim();
    // We deliver across Hyderabad — any 500xxx pincode is serviceable, plus the
    // explicit popular-areas list (kept for labels / quick-pick).
    return /^500\d{3}$/.test(p) || SERVICEABLE_PINCODES.includes(p);
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
    // Real, free, key-less reverse-geocode (CORS-enabled) → your actual area + pincode.
    // Falls back to the deterministic mock if the request fails.
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );
      if (!res.ok) throw new Error("reverse-geocode failed");
      const d = (await res.json()) as {
        locality?: string;
        city?: string;
        principalSubdivision?: string;
        postcode?: string;
      };
      const area = d.locality || d.city || d.principalSubdivision || "Current location";
      setZoneState({
        area,
        pincode: d.postcode ?? "",
        city: d.city || d.principalSubdivision || "",
        lat: latitude,
        lng: longitude,
      });
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
