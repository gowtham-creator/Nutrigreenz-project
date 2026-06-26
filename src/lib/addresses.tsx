"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import {
  GOOGLE_ENRICH_EVENT,
  type GoogleEnrichDetail,
} from "@/lib/google-enrich-client";
import type { Address } from "@/types/nutrigreenz";

/**
 * Saved delivery addresses.
 *
 * SIGNED-IN: the source of truth is the server address book
 * (`/api/account/addresses`), attached to the CANONICAL customer — so the SAME
 * addresses appear across a person's Google + phone sign-ins, and the first
 * address defaults to "Home". On first sign-in we one-time import any addresses
 * the visitor saved locally (guest or this account's old localStorage book) so
 * nothing is ever lost, then the DB takes over.
 *
 * SIGNED-OUT (guest): addresses stay in localStorage exactly as before, so a
 * visitor can still build a basket + addresses before creating an account; they
 * are folded into the DB book on sign-in.
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

/* ── localStorage (guest + one-time import source) ─────────────────────────── */

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

/* ── server wire shape ⇄ UI Address mapping ────────────────────────────────── */

type ServerLabel = "home" | "work" | "other";

interface ServerAddress {
  id: string;
  fullName: string | null;
  phone: string | null;
  label: ServerLabel;
  customLabel: string | null;
  buildingFloorFlat: string | null;
  roadStreet: string | null;
  areaLandmark: string | null;
  city: string | null;
  pincode: string | null;
  region: string | null;
  state: string | null;
  country: string;
  isDefault: boolean;
}

/** DB row → the UI `Address` shape every component already consumes. */
function fromServer(s: ServerAddress): Address {
  return {
    id: s.id,
    fullName: s.fullName ?? "",
    phone: s.phone ?? "",
    line1: s.buildingFloorFlat ?? "",
    line2: s.roadStreet ?? undefined,
    landmark: s.areaLandmark ?? undefined,
    city: s.city ?? "",
    state: s.state ?? "",
    pincode: s.pincode ?? "",
    type: s.label,
    isDefault: s.isDefault,
    label: s.label === "other" ? s.customLabel ?? undefined : undefined,
  };
}

/** UI input → the JSON body the address API expects (country is server-locked). */
function toServerBody(input: AddressInput): Record<string, unknown> {
  return {
    fullName: input.fullName,
    phone: input.phone,
    label: input.type,
    customLabel: input.type === "other" ? input.label ?? null : null,
    buildingFloorFlat: input.line1,
    roadStreet: input.line2 ?? null,
    areaLandmark: input.landmark ?? null,
    city: input.city,
    pincode: input.pincode,
    region: null,
    state: input.state,
    isDefault: input.isDefault,
  };
}

async function apiList(): Promise<Address[] | null> {
  try {
    const res = await fetch("/api/account/addresses", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { addresses?: ServerAddress[] };
    return (data.addresses ?? []).map(fromServer);
  } catch {
    return null;
  }
}

async function apiCreate(input: AddressInput): Promise<Address | null> {
  try {
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toServerBody(input)),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: ServerAddress };
    return data.address ? fromServer(data.address) : null;
  } catch {
    return null;
  }
}

async function apiUpdate(
  id: string,
  input: Partial<AddressInput>,
): Promise<boolean> {
  try {
    // Only forward keys the caller actually set (avoid clobbering with blanks).
    const res = await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody(input)),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Map only the provided partial fields → API body keys. */
function patchBody(input: Partial<AddressInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.fullName !== undefined) out.fullName = input.fullName;
  if (input.phone !== undefined) out.phone = input.phone;
  if (input.type !== undefined) {
    out.label = input.type;
    out.customLabel =
      input.type === "other" ? input.label ?? null : null;
  } else if (input.label !== undefined) {
    out.customLabel = input.label ?? null;
  }
  if (input.line1 !== undefined) out.buildingFloorFlat = input.line1;
  if (input.line2 !== undefined) out.roadStreet = input.line2 ?? null;
  if (input.landmark !== undefined) out.areaLandmark = input.landmark ?? null;
  if (input.city !== undefined) out.city = input.city;
  if (input.pincode !== undefined) out.pincode = input.pincode;
  if (input.state !== undefined) out.state = input.state;
  if (input.isDefault !== undefined) out.isDefault = input.isDefault;
  return out;
}

async function apiDelete(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/account/addresses/${id}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiSetDefault(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setDefault: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── provider ──────────────────────────────────────────────────────────────── */

export function AddressProvider({ children }: { children: ReactNode }) {
  const { account, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Guards a one-time localStorage→DB import per identity.
  const importedFor = useRef<Set<string>>(new Set());

  const signedIn = Boolean(account);
  // Storage key for the active identity (guest vs the signed-in account).
  const storageKey = account
    ? `${USER_PREFIX}${account.uid || account.email || account.phone || "user"}`
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

    let cancelled = false;

    if (!signedIn) {
      // Guest → localStorage only (unchanged behaviour).
      setAddresses(normalize(readStored(GUEST_KEY)));
      setLoadedKey(storageKey);
      return () => {
        cancelled = true;
      };
    }

    // Signed-in → DB is the source of truth, with a one-time local import.
    (async () => {
      const fromDb = await apiList();
      if (cancelled) return;

      // API unavailable (e.g. Supabase unconfigured / offline) → fall back to
      // the local book so the UI keeps working; never lose data.
      if (fromDb === null) {
        const localAccount = readStored(storageKey);
        const guest = readStored(GUEST_KEY);
        setAddresses(normalize([...localAccount, ...guest]));
        setLoadedKey(storageKey);
        return;
      }

      let current = fromDb;

      // One-time import: fold any locally-stored addresses (this account's old
      // localStorage book + anything added while browsing as a guest) into the
      // DB, then clear the local buckets so nothing resurfaces or duplicates.
      if (!importedFor.current.has(storageKey)) {
        importedFor.current.add(storageKey);
        const pending = [...readStored(storageKey), ...readStored(GUEST_KEY)];
        if (pending.length > 0) {
          for (const addr of pending) {
            // eslint-disable-next-line no-await-in-loop -- preserve order + one default
            const created = await apiCreate({
              fullName: addr.fullName,
              phone: addr.phone,
              line1: addr.line1,
              line2: addr.line2,
              landmark: addr.landmark,
              city: addr.city,
              state: addr.state,
              pincode: addr.pincode,
              type: addr.type,
              label: addr.label,
              isDefault: addr.isDefault,
            });
            if (created) current = [...current, created];
          }
          writeStored(storageKey, []);
          writeStored(GUEST_KEY, []);
          // Re-read so server-side defaulting/ordering is authoritative.
          const refreshed = await apiList();
          if (!cancelled && refreshed) current = refreshed;
        }
      }

      if (!cancelled) {
        setAddresses(normalize(current));
        setLoadedKey(storageKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, storageKey, loadedKey, signedIn]);

  // Persist GUEST changes to localStorage (signed-in writes go to the DB).
  useEffect(() => {
    if (loadedKey === null || loadedKey !== storageKey) return;
    if (signedIn) return;
    writeStored(GUEST_KEY, addresses);
  }, [addresses, loadedKey, storageKey, signedIn]);

  // Task T6 — after a Google sign-in, the People-API enrichment may auto-import
  // the account's addresses server-side. Re-pull the canonical DB book so the
  // freshly imported addresses appear immediately (no reload needed). Best-effort.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEnrich = (event: Event) => {
      const detail = (event as CustomEvent<GoogleEnrichDetail>).detail;
      if (!detail || detail.addressesAdded <= 0) return;
      void (async () => {
        const fresh = await apiList();
        if (fresh) setAddresses(normalize(fresh));
      })();
    };
    window.addEventListener(GOOGLE_ENRICH_EVENT, onEnrich);
    return () => window.removeEventListener(GOOGLE_ENRICH_EVENT, onEnrich);
  }, []);

  const add = useCallback(
    (input: AddressInput) => {
      const id = makeId();
      // Optimistic local insert (mirrors the previous behaviour exactly).
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
      // Signed-in → persist to the DB and reconcile with the canonical row.
      if (signedIn) {
        void (async () => {
          const created = await apiCreate(input);
          if (created) {
            setAddresses((prev) =>
              normalize(prev.map((a) => (a.id === id ? created : a))),
            );
          }
        })();
      }
      return id;
    },
    [signedIn],
  );

  const update = useCallback(
    (id: string, input: Partial<AddressInput>) => {
      setAddresses((prev) => {
        const promoting = input.isDefault === true;
        const next = prev.map((a) => {
          if (a.id === id) return { ...a, ...input };
          return promoting ? { ...a, isDefault: false } : a;
        });
        return normalize(next);
      });
      if (signedIn) void apiUpdate(id, input);
    },
    [signedIn],
  );

  const remove = useCallback(
    (id: string) => {
      setAddresses((prev) => normalize(prev.filter((a) => a.id !== id)));
      if (signedIn) void apiDelete(id);
    },
    [signedIn],
  );

  const setDefault = useCallback(
    (id: string) => {
      setAddresses((prev) =>
        normalize(prev.map((a) => ({ ...a, isDefault: a.id === id }))),
      );
      if (signedIn) void apiSetDefault(id);
    },
    [signedIn],
  );

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
