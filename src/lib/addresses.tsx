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
import { useAuth } from "@/lib/auth";
import type { Address } from "@/types/nutrigreenz";

/**
 * Addresses are scoped to the current identity (like the cart), so a signed-out
 * visitor and every signed-in account keep their OWN saved addresses and never
 * see one another's. A brand-new account starts empty — there is no seed data.
 */
const LEGACY_KEY = "ng.addresses.v1"; // pre-identity global store — abandoned
const GUEST_KEY = "ng.addresses.v1::guest";
const USER_PREFIX = "ng.addresses.v1::u:";

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

function readStored(key: string): Address[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAddress);
  } catch {
    return [];
  }
}

function writeStored(key: string, addresses: Address[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(addresses));
  } catch {
    /* quota / private-mode — fail silently */
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
  const { account, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Storage key for the active identity (guest vs the signed-in account).
  const storageKey = account
    ? `${USER_PREFIX}${account.email || account.phone || "user"}`
    : GUEST_KEY;

  // Load the right address book whenever the identity changes (after auth settles).
  useEffect(() => {
    if (authLoading) return;
    if (loadedKey === storageKey) return;
    // Drop the pre-identity global store once, so its old data never resurfaces.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* ignore */
      }
    }
    let next = readStored(storageKey);
    // On sign-in, fold any addresses added while browsing as a guest into the
    // account book, then clear the guest bucket.
    if (storageKey.startsWith(USER_PREFIX)) {
      const guest = readStored(GUEST_KEY);
      if (guest.length > 0) {
        next = [...next, ...guest];
        writeStored(storageKey, normalize(next));
        writeStored(GUEST_KEY, []);
      }
    }
    setAddresses(normalize(next));
    setLoadedKey(storageKey);
  }, [authLoading, storageKey, loadedKey]);

  // Persist whenever addresses change — only once they belong to the active identity.
  useEffect(() => {
    if (loadedKey === null || loadedKey !== storageKey) return;
    writeStored(storageKey, addresses);
  }, [addresses, loadedKey, storageKey]);

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
