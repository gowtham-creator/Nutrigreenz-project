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
import type { Address } from "@/types/nutrigreenz";

const STORAGE_KEY = "ng.addresses.v1";

/** Fields the user can edit; the store owns `id` and seeds the rest. */
export type AddressInput = Omit<Address, "id">;

interface AddressContextValue {
  /** All saved addresses; the default (if any) is always sorted first. */
  addresses: Address[];
  /** Add a new address; returns its generated id. First one becomes default. */
  add: (input: AddressInput) => string;
  /** Patch an existing address by id. */
  update: (id: string, input: Partial<AddressInput>) => void;
  /** Delete an address; if it was the default, the next one is promoted. */
  remove: (id: string) => void;
  /** Mark one address as the single default. */
  setDefault: (id: string) => void;
  /** The current default address, or null if none exist. */
  defaultAddress: Address | null;
}

const AddressContext = createContext<AddressContextValue | null>(null);

/* ── Seed data (§3.10) — a default Home, a Work, and a custom "Other". ── */
const SEED_ADDRESSES: Address[] = [
  {
    id: "addr-home",
    fullName: "Ananya Rao",
    phone: "+91 98765 43210",
    line1: "Flat 4B, Banyan Grove Apartments",
    line2: "Road No. 12, Madhapur",
    landmark: "Near Inorbit Mall",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    type: "home",
    isDefault: true,
  },
  {
    id: "addr-work",
    fullName: "Ananya Rao",
    phone: "+91 98765 43210",
    line1: "7th Floor, Prestige Tech Park",
    line2: "Hitech City Road, Gachibowli",
    landmark: "Near DLF Cyber City",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500032",
    type: "work",
  },
  {
    id: "addr-other",
    fullName: "Sundar Rao",
    phone: "+91 90080 11223",
    line1: "Door No. 21, Lakshmi Nilaya",
    line2: "KPHB Phase 5, Kukatpally",
    landmark: "Beside Ganesha temple",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500072",
    type: "other",
    label: "Parents' home",
  },
];

function isAddress(entry: unknown): entry is Address {
  if (typeof entry !== "object" || entry === null) return false;
  const a = entry as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.fullName === "string" &&
    typeof a.phone === "string" &&
    typeof a.line1 === "string" &&
    typeof a.city === "string" &&
    typeof a.state === "string" &&
    typeof a.pincode === "string" &&
    (a.type === "home" || a.type === "work" || a.type === "other")
  );
}

function readStored(): Address[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isAddress);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

/** Ensure exactly one default and sort the default to the front. */
function normalize(list: Address[]): Address[] {
  if (list.length === 0) return list;
  const hasDefault = list.some((a) => a.isDefault);
  const withDefault = hasDefault
    ? list
    : list.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
  return [...withDefault].sort(
    (a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)),
  );
}

function makeId(): string {
  return `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (seed on first visit).
  useEffect(() => {
    setAddresses(normalize(readStored() ?? SEED_ADDRESSES));
    setHydrated(true);
  }, []);

  // Persist whenever addresses change (only after initial hydration).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
    } catch {
      /* quota / private-mode — fail silently */
    }
  }, [addresses, hydrated]);

  const add = useCallback((input: AddressInput) => {
    const id = makeId();
    setAddresses((prev) => {
      const makeFirstDefault = prev.length === 0;
      const next: Address = {
        ...input,
        id,
        isDefault: makeFirstDefault ? true : Boolean(input.isDefault),
      };
      const cleared = next.isDefault
        ? prev.map((a) => ({ ...a, isDefault: false }))
        : prev;
      return normalize([...cleared, next]);
    });
    return id;
  }, []);

  const update = useCallback((id: string, input: Partial<AddressInput>) => {
    setAddresses((prev) => {
      const promoting = input.isDefault === true;
      const next = prev.map((a) => {
        if (a.id === id) return { ...a, ...input };
        return promoting ? { ...a, isDefault: false } : a;
      });
      return normalize(next);
    });
  }, []);

  const remove = useCallback((id: string) => {
    setAddresses((prev) => normalize(prev.filter((a) => a.id !== id)));
  }, []);

  const setDefault = useCallback((id: string) => {
    setAddresses((prev) =>
      normalize(prev.map((a) => ({ ...a, isDefault: a.id === id }))),
    );
  }, []);

  const defaultAddress = useMemo(
    () => addresses.find((a) => a.isDefault) ?? addresses[0] ?? null,
    [addresses],
  );

  const value = useMemo<AddressContextValue>(
    () => ({ addresses, add, update, remove, setDefault, defaultAddress }),
    [addresses, add, update, remove, setDefault, defaultAddress],
  );

  return (
    <AddressContext.Provider value={value}>{children}</AddressContext.Provider>
  );
}

/** Access saved addresses + mutators. Must be used within <AddressProvider>. */
export function useAddresses(): AddressContextValue {
  const ctx = useContext(AddressContext);
  if (!ctx)
    throw new Error("useAddresses must be used within an <AddressProvider>");
  return ctx;
}
