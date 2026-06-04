"use client";

/**
 * Captain field-tool client store (Milestone-1 / demo).
 *
 * Holds the mock captain identity + the "offline customers" captured at a
 * stall during the day. State is kept in React context and mirrored to
 * localStorage so the four /captain/* screens share a single source of truth
 * across navigations within a session.
 *
 * Milestone-2 (real): on online OTP signup, the captured `mobile` is
 * cross-matched against the offline DB to mark the customer "Onboarded" and
 * import their stall purchases as offline orders. No persistence/auth here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PayMode = "Cash" | "UPI";

export interface CapturedLineItem {
  sku: string;
  title: string;
  unit: string;
  price: number;
  qty: number;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  /** 10-digit mobile — the key cross-match field for M2 onboarding. */
  mobile: string;
  community: string;
  items: CapturedLineItem[];
  total: number;
  payMode: PayMode;
  notes?: string;
  /** ISO timestamp of capture. */
  capturedAt: string;
}

export interface CaptainIdentity {
  name: string;
  initials: string;
  area: string;
  stall: string;
}

const CAPTAIN: CaptainIdentity = {
  name: "Sneha Kumar",
  initials: "SK",
  area: "HYD · West",
  stall: "My Home Avatar gate",
};

const STORAGE_KEY = "ng-captain-offline-customers";

/** A few pre-seeded captures so the day reads as already in progress. */
const SEED: OfflineCustomer[] = [
  {
    id: "OFF-SEED-1",
    name: "Lakshmi Narayan",
    mobile: "9845012233",
    community: "My Home Avatar",
    items: [
      { sku: "GO-500", title: "Cold-pressed groundnut oil", unit: "500 ml", price: 240, qty: 2 },
      { sku: "FM-1000", title: "Foxtail millet", unit: "1 kg", price: 180, qty: 1 },
    ],
    total: 660,
    payMode: "UPI",
    notes: "Regular — asked about A2 ghee restock.",
    capturedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
  },
  {
    id: "OFF-SEED-2",
    name: "Imran Q.",
    mobile: "9972204417",
    community: "Aparna Sarovar Zenith",
    items: [{ sku: "HN-250", title: "Forest honey", unit: "250 g", price: 320, qty: 1 }],
    total: 320,
    payMode: "Cash",
    capturedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
];

interface CaptainStore {
  captain: CaptainIdentity;
  customers: OfflineCustomer[];
  /** Customers captured today (local date). */
  todayCustomers: OfflineCustomer[];
  addCustomer: (c: Omit<OfflineCustomer, "id" | "capturedAt">) => OfflineCustomer;
  /** Derived end-of-day numbers for the home + settle screens. */
  stats: {
    count: number;
    orders: number;
    gmv: number;
    cash: number;
    upi: number;
  };
}

const Ctx = createContext<CaptainStore | null>(null);

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function CaptainStoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<OfflineCustomer[]>(SEED);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount (client-only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OfflineCustomer[];
        if (Array.isArray(parsed) && parsed.length > 0) setCustomers(parsed);
      }
    } catch {
      /* ignore malformed cache — fall back to seed */
    }
    setHydrated(true);
  }, []);

  // Persist after hydration so we never clobber stored data with the seed.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    } catch {
      /* storage full / unavailable — non-fatal for a demo */
    }
  }, [customers, hydrated]);

  const addCustomer = useCallback<CaptainStore["addCustomer"]>((input) => {
    const record: OfflineCustomer = {
      ...input,
      id: `OFF-${Date.now().toString(36).toUpperCase()}`,
      capturedAt: new Date().toISOString(),
    };
    setCustomers((prev) => [record, ...prev]);
    return record;
  }, []);

  const value = useMemo<CaptainStore>(() => {
    const todayCustomers = customers.filter((c) => isToday(c.capturedAt));
    const gmv = todayCustomers.reduce((s, c) => s + c.total, 0);
    const cash = todayCustomers
      .filter((c) => c.payMode === "Cash")
      .reduce((s, c) => s + c.total, 0);
    const upi = todayCustomers
      .filter((c) => c.payMode === "UPI")
      .reduce((s, c) => s + c.total, 0);
    return {
      captain: CAPTAIN,
      customers,
      todayCustomers,
      addCustomer,
      stats: {
        count: todayCustomers.length,
        orders: todayCustomers.filter((c) => c.items.length > 0).length,
        gmv,
        cash,
        upi,
      },
    };
  }, [customers, addCustomer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCaptain(): CaptainStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCaptain must be used within <CaptainStoreProvider>");
  return ctx;
}

/** Catalog the captain can add to a stall cart. */
export const STALL_CATALOG: Omit<CapturedLineItem, "qty">[] = [
  { sku: "GO-500", title: "Cold-pressed groundnut oil", unit: "500 ml", price: 240 },
  { sku: "GO-1000", title: "Cold-pressed groundnut oil", unit: "1 L", price: 460 },
  { sku: "FM-1000", title: "Foxtail millet", unit: "1 kg", price: 180 },
  { sku: "GH-500", title: "A2 cow ghee", unit: "500 ml", price: 720 },
  { sku: "HN-250", title: "Forest honey", unit: "250 g", price: 320 },
  { sku: "SF-200", title: "Mixed superfood seeds", unit: "200 g", price: 260 },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Deterministic "Weekday D Mon" formatter. Avoids `toLocaleDateString`, whose
 * locale data differs between the Node server and the browser — which would
 * otherwise cause a React hydration mismatch on date-bearing headers.
 */
export function formatCaptainDate(d: Date = new Date()): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Communities the captain rotates stalls through. */
export const COMMUNITIES = [
  "My Home Avatar",
  "Aparna Sarovar Zenith",
  "Lodha Bellezza",
  "Manjeera Trinity",
  "My Home Bhooja",
  "Other / walk-up",
];
