"use client";

/**
 * Captain field-tool client store — REAL, DB-backed.
 *
 * Hydrates the signed-in captain's identity (`GET /api/captain/me`) and today's
 * stall captures + stats (`GET /api/captain/captures`), and records new captures
 * (`POST /api/captain/captures`) with an OPTIMISTIC add + an offline retry queue.
 * The four /captain/* screens share this one source of truth across navigations.
 *
 * ── THE money boundary ────────────────────────────────────────────────────────
 * The API speaks INTEGER PAISE; every /captain screen speaks whole RUPEES. This
 * module is the SINGLE conversion point — {@link paiseToRupees} is applied when
 * mapping API records into the store's rupee models ({@link captureToCustomer},
 * {@link settlementToView}). Nothing above this module ever sees paise, and the
 * POST payload sends catalog RUPEE prices (the server converts to paise and
 * recomputes the authoritative total).
 *
 * ── Offline model ─────────────────────────────────────────────────────────────
 * State is mirrored write-through to localStorage so a captain on poor signal
 * still sees their day. A capture that fails to POST is parked in an outbox and
 * retried on next mount and on the browser `online` event. The cache never
 * clobbers fresh server data — on reconcile the server response always wins,
 * while still-unsynced optimistic rows are preserved on top.
 */

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
import type { CaptainMe } from "@/lib/captains";
import type {
  CaptainCapture,
  CaptainPickup,
  CaptainPickupStatus,
  CaptainSettlement,
  CaptainStats,
} from "@/types/nutrigreenz";

export type PayMode = "Cash" | "UPI";

export interface CapturedLineItem {
  sku: string;
  title: string;
  unit: string;
  /** Whole-rupee unit price (the store never exposes paise upward). */
  price: number;
  qty: number;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  /** 10-digit mobile — the key cross-match field for onboarding. */
  mobile: string;
  community: string;
  items: CapturedLineItem[];
  /** Whole-rupee order total. */
  total: number;
  payMode: PayMode;
  notes?: string;
  /** ISO timestamp of capture. */
  capturedAt: string;
}

/** The signed-in captain's identity, projected from `GET /api/captain/me`. */
export type CaptainIdentity = CaptainMe;

/* ── the single money boundary ────────────────────────────────────────────── */

/** THE paise→rupee conversion. API money is integer paise; screens use rupees. */
const paiseToRupees = (paise: number): number => Math.round(paise) / 100;

/* ── localStorage keys (offline mirror + retry outbox) ────────────────────── */

const CACHE_KEY = "ng.captain.captures.v1";
const IDENTITY_KEY = "ng.captain.identity.v1";
const OUTBOX_KEY = "ng.captain.outbox.v1";

/* ── API ⇄ store mappers (paise → rupees happens here, once) ───────────────── */

function captureToCustomer(c: CaptainCapture): OfflineCustomer {
  return {
    id: c.id,
    name: c.customerName,
    mobile: c.customerMobile,
    community: c.community ?? "",
    items: c.items.map((it) => ({
      sku: it.sku,
      title: it.title,
      unit: it.unit,
      price: paiseToRupees(it.pricePaise),
      qty: it.qty,
    })),
    total: paiseToRupees(c.totalPaise),
    payMode: c.payMode === "upi" ? "UPI" : "Cash",
    notes: c.notes ?? undefined,
    capturedAt: c.capturedAt,
  };
}

/** Rupee-shaped settlement for the Settle screen (all paise fields converted). */
export interface CaptainSettlementView {
  id: string;
  settleDate: string;
  expectedGmv: number;
  cashExpected: number;
  upiExpected: number;
  cashCounted: number;
  variance: number;
  commission: number;
  submittedAt: string;
}

function settlementToView(s: CaptainSettlement): CaptainSettlementView {
  return {
    id: s.id,
    settleDate: s.settleDate,
    expectedGmv: paiseToRupees(s.expectedGmvPaise),
    cashExpected: paiseToRupees(s.cashExpectedPaise),
    upiExpected: paiseToRupees(s.upiExpectedPaise),
    cashCounted: paiseToRupees(s.cashCountedPaise),
    variance: paiseToRupees(s.variancePaise),
    commission: paiseToRupees(s.commissionPaise),
    submittedAt: s.submittedAt,
  };
}

/* ── capture POST payload (RUPEE prices) + offline outbox ──────────────────── */

interface CapturePayload {
  name: string;
  mobile: string;
  community?: string;
  /** Line prices in RUPEES — the server converts to paise + recomputes total. */
  items: { sku: string; title: string; unit: string; price: number; qty: number }[];
  payMode: "cash" | "upi";
  notes?: string;
}

interface OutboxItem {
  /** The optimistic row's temporary id, so a successful POST replaces the right row. */
  tempId: string;
  payload: CapturePayload;
}

type FlushOutcome = "ok" | "retry" | "drop";

function toPayload(input: Omit<OfflineCustomer, "id" | "capturedAt">): CapturePayload {
  return {
    name: input.name,
    mobile: input.mobile,
    community: input.community || undefined,
    items: input.items.map((i) => ({
      sku: i.sku,
      title: i.title,
      unit: i.unit,
      price: i.price,
      qty: i.qty,
    })),
    payMode: input.payMode === "UPI" ? "upi" : "cash",
    notes: input.notes,
  };
}

/* ── API response shapes (source of truth: src/app/api/captain/**) ─────────── */

interface MeResponse {
  ok: boolean;
  captain?: CaptainMe;
  error?: string;
}
interface CapturesResponse {
  ok: boolean;
  captures?: CaptainCapture[];
  stats?: CaptainStats;
}
interface CaptureResponse {
  ok: boolean;
  capture?: CaptainCapture;
  stats?: CaptainStats;
  error?: string;
}
interface SettlementResponse {
  ok: boolean;
  settlement?: CaptainSettlement;
  error?: string;
}
interface PickupsResponse {
  ok: boolean;
  pickups?: CaptainPickup[];
}
interface PickupResponse {
  ok: boolean;
  pickup?: CaptainPickup;
  error?: string;
}

/** Parse JSON without letting `any` escape; null on malformed/empty bodies. */
async function readJson<T>(res: Response): Promise<T | null> {
  try {
    const raw: unknown = await res.json();
    return raw as T;
  } catch {
    return null;
  }
}

/* ── localStorage helpers (SSR-safe) ──────────────────────────────────────── */

function readCache(): OfflineCustomer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineCustomer[]) : [];
  } catch {
    return [];
  }
}
function writeCache(list: OfflineCustomer[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* quota / private-mode — non-fatal */
  }
}
function readIdentityCache(): CaptainIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CaptainIdentity) : null;
  } catch {
    return null;
  }
}
function writeIdentityCache(identity: CaptainIdentity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    /* non-fatal */
  }
}
function readOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}
function writeOutbox(items: OutboxItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* non-fatal */
  }
}
function enqueue(item: OutboxItem): void {
  writeOutbox([...readOutbox(), item]);
}
function dequeue(tempId: string): void {
  writeOutbox(readOutbox().filter((o) => o.tempId !== tempId));
}

/** Wipe all captain local data — called on (re)login so a device handoff can
 *  never leak one captain's cache/outbox into another captain's session. */
export function clearCaptainCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
    window.localStorage.removeItem(IDENTITY_KEY);
    window.localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* non-fatal */
  }
}

/* ── store ─────────────────────────────────────────────────────────────────── */

interface CaptainStore {
  /** Signed-in identity, or null while it hydrates (never redirects on 401). */
  captain: CaptainIdentity | null;
  /** Effective community rotation — the captain's assigned list, else the default. */
  communities: string[];
  customers: OfflineCustomer[];
  /** Customers captured today (local/IST calendar day). */
  todayCustomers: OfflineCustomer[];
  addCustomer: (c: Omit<OfflineCustomer, "id" | "capturedAt">) => OfflineCustomer;
  /** Derived end-of-day numbers (RUPEES) for the home + settle screens. */
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

/** Server captures win on reconcile; still-unsynced optimistic rows ride on top. */
function mergeServer(prev: OfflineCustomer[], server: OfflineCustomer[]): OfflineCustomer[] {
  const pendingIds = new Set(readOutbox().map((o) => o.tempId));
  const pending = prev.filter((c) => pendingIds.has(c.id));
  return [...pending, ...server];
}

export function CaptainStoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<OfflineCustomer[]>([]);
  const [identity, setIdentity] = useState<CaptainIdentity | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const flushingRef = useRef(false);

  // POST one queued capture; reconcile the optimistic row with the server row.
  const flushOne = useCallback(async (item: OutboxItem): Promise<FlushOutcome> => {
    try {
      const res = await fetch("/api/captain/captures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        const data = await readJson<CaptureResponse>(res);
        if (data?.ok && data.capture) {
          const server = captureToCustomer(data.capture);
          setCustomers((prev) => prev.map((c) => (c.id === item.tempId ? server : c)));
        }
        dequeue(item.tempId);
        return "ok";
      }
      // 5xx / 503 — transient; keep it queued for the next attempt.
      if (res.status >= 500) return "retry";
      // 4xx — the payload will never be accepted; stop retrying, keep the local row.
      dequeue(item.tempId);
      return "drop";
    } catch {
      // Network / offline — keep it queued.
      return "retry";
    }
  }, []);

  // Drain the outbox oldest-first; stop the pass on the first transient failure.
  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    flushingRef.current = true;
    try {
      let queue = readOutbox();
      while (queue.length > 0) {
        const outcome = await flushOne(queue[0]);
        if (outcome === "retry") break;
        queue = readOutbox(); // flushOne dequeued on ok/drop
      }
    } finally {
      flushingRef.current = false;
    }
  }, [flushOne]);

  // Mount: instant paint from cache, then hydrate identity + today's captures,
  // then drain the outbox. The pre-auth /captain/login route skips the network.
  useEffect(() => {
    const cachedCustomers = readCache();
    if (cachedCustomers.length > 0) setCustomers(cachedCustomers);
    const cachedIdentity = readIdentityCache();
    if (cachedIdentity) setIdentity(cachedIdentity);
    setHydrated(true);

    if (typeof window !== "undefined" && window.location.pathname === "/captain/login") {
      return; // pre-auth page — never hit the authed endpoints (no 401 noise)
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/captain/me", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!cancelled && res.ok) {
          const data = await readJson<MeResponse>(res);
          if (data?.ok && data.captain) setIdentity(data.captain);
        } else if (!cancelled && res.status === 401) {
          setIdentity(null); // do NOT redirect — the Edge proxy owns auth redirects
        }
        // 503 / offline: keep the cached identity.
      } catch {
        /* offline — keep cached identity */
      }

      try {
        const res = await fetch("/api/captain/captures", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!cancelled && res.ok) {
          const data = await readJson<CapturesResponse>(res);
          if (data?.ok && Array.isArray(data.captures)) {
            const server = data.captures.map(captureToCustomer);
            setCustomers((prev) => mergeServer(prev, server));
          }
        }
        // 401 / offline: keep the cached captures.
      } catch {
        /* offline — keep cached captures */
      }

      if (!cancelled) await flushOutbox();
    })();

    return () => {
      cancelled = true;
    };
  }, [flushOutbox]);

  // Write-through the offline mirror (only after first hydration).
  useEffect(() => {
    if (!hydrated) return;
    writeCache(customers);
  }, [customers, hydrated]);

  useEffect(() => {
    if (!hydrated || !identity) return;
    writeIdentityCache(identity);
  }, [identity, hydrated]);

  // Retry the outbox the moment connectivity returns.
  useEffect(() => {
    const onOnline = () => {
      void flushOutbox();
    };
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    };
  }, [flushOutbox]);

  const addCustomer = useCallback<CaptainStore["addCustomer"]>(
    (input) => {
      const tempId = `OFF-LOCAL-${Date.now().toString(36).toUpperCase()}`;
      const record: OfflineCustomer = {
        ...input,
        id: tempId,
        capturedAt: new Date().toISOString(),
      };
      // Optimistic: show it instantly…
      setCustomers((prev) => [record, ...prev]);
      // …then queue + attempt the real POST (retried offline).
      enqueue({ tempId, payload: toPayload(input) });
      void flushOutbox();
      return record;
    },
    [flushOutbox],
  );

  const value = useMemo<CaptainStore>(() => {
    const todayCustomers = customers.filter((c) => isToday(c.capturedAt));
    const gmv = todayCustomers.reduce((s, c) => s + c.total, 0);
    const cash = todayCustomers
      .filter((c) => c.payMode === "Cash")
      .reduce((s, c) => s + c.total, 0);
    const upi = todayCustomers
      .filter((c) => c.payMode === "UPI")
      .reduce((s, c) => s + c.total, 0);
    const communities =
      identity?.communities && identity.communities.length > 0 ? identity.communities : COMMUNITIES;
    return {
      captain: identity,
      communities,
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
  }, [customers, identity, addCustomer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCaptain(): CaptainStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCaptain must be used within <CaptainStoreProvider>");
  return ctx;
}

/* ── screen-facing API helpers (Settle + Pickups) ─────────────────────────── */

/**
 * Submit today's end-of-day cash-up. `cashCountedRupees` is the physical cash
 * the captain counted; the server recomputes expected GMV/cash/UPI, variance and
 * commission from today's captures. Returns the settlement in RUPEES; throws on
 * failure so the screen can keep the form editable.
 */
export async function submitSettlement(cashCountedRupees: number): Promise<CaptainSettlementView> {
  const res = await fetch("/api/captain/settlements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cashCounted: cashCountedRupees }),
  });
  const data = await readJson<SettlementResponse>(res);
  if (!res.ok || !data?.ok || !data.settlement) {
    throw new Error(data?.error ?? "settlement_failed");
  }
  return settlementToView(data.settlement);
}

/** Today's community pickups (due first). Resolves to an empty list on any
 *  failure so the screen degrades to its empty state rather than throwing. */
export async function fetchCaptainPickups(): Promise<CaptainPickup[]> {
  try {
    const res = await fetch("/api/captain/pickups", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const data = await readJson<PickupsResponse>(res);
    if (res.ok && data?.ok && Array.isArray(data.pickups)) return data.pickups;
    return [];
  } catch {
    return [];
  }
}

/** Advance a pickup (due → collected → handed_over). Throws on failure so the
 *  caller can revert the optimistic status change. */
export async function advanceCaptainPickup(
  id: string,
  status: CaptainPickupStatus,
): Promise<CaptainPickup> {
  const res = await fetch(`/api/captain/pickups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await readJson<PickupResponse>(res);
  if (!res.ok || !data?.ok || !data.pickup) {
    throw new Error(data?.error ?? "pickup_update_failed");
  }
  return data.pickup;
}

/* ── shared statics + formatters ──────────────────────────────────────────── */

/** Catalog the captain can add to a stall cart. Prices are whole RUPEES. */
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

/** Friendly pickup timing from an ISO `dueAt` (client-only render, so wall-clock
 *  time is safe). Falls back to "Scheduled" when the pickup has no due time. */
export function formatPickupWhen(dueAt: string | null): string {
  if (!dueAt) return "Scheduled";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "Scheduled";
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const dayLabel =
    d.toDateString() === now.toDateString()
      ? "Today"
      : d.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : formatCaptainDate(d);
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${dayLabel} · ${h}:${min} ${ampm}`;
}

/** Default community rotation — the fallback when a captain has none assigned. */
export const COMMUNITIES = [
  "My Home Avatar",
  "Aparna Sarovar Zenith",
  "Lodha Bellezza",
  "Manjeera Trinity",
  "My Home Bhooja",
  "Other / walk-up",
];
