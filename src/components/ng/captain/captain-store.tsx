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
import { toast } from "sonner";
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
  /** Rupee unit price, exact to the paisa (the store never exposes paise upward). */
  price: number;
  qty: number;
  /** Catalogue variant the line was sold from. Sent so the server can check it
   *  against this captain's allocation and join the sale to a real SKU. */
  variantId?: string;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  /** 10-digit mobile — the key cross-match field for onboarding. */
  mobile: string;
  community: string;
  items: CapturedLineItem[];
  /** Rupee order total. */
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
/** Rupees → integer paise, for sums that must not drift (0.1 + 0.2 ≠ 0.3). */
const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

/** "₹1,349.50" / "₹500": en-IN grouping, paise shown only when there are any. */
export function formatInr(rupees: number): string {
  const paise = rupeesToPaise(rupees);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise) / 100;
  return `${sign}₹${abs.toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

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
  items: { sku: string; title: string; unit: string; price: number; qty: number; variantId?: string }[];
  payMode: "cash" | "upi";
  notes?: string;
  /** Idempotency key (the outbox temp id): a retry never records the sale twice. */
  clientRef?: string;
}

interface OutboxItem {
  /** The optimistic row's temporary id, so a successful POST replaces the right row. */
  tempId: string;
  payload: CapturePayload;
}

type FlushOutcome = "ok" | "retry" | "drop";

function toPayload(
  input: Omit<OfflineCustomer, "id" | "capturedAt">,
  clientRef: string,
): CapturePayload {
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
      variantId: i.variantId,
    })),
    payMode: input.payMode === "UPI" ? "upi" : "cash",
    notes: input.notes,
    clientRef,
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

/** A refused pickup update. `pickup` is the server's current row (on a 409). */
export class PickupUpdateError extends Error {
  constructor(
    message: string,
    readonly pickup?: CaptainPickup,
  ) {
    super(message);
  }
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

/**
 * Wipe all captain local data on (re)login so a device handoff can never leak
 * one captain's cache/outbox into another captain's session. When the SAME
 * captain signs back in (their session ran out mid-shift) the cache and the
 * unsynced outbox are kept: wiping them here used to lose those sales.
 */
export function clearCaptainCache(signedInCaptainId?: string): void {
  if (typeof window === "undefined") return;
  if (signedInCaptainId && readIdentityCache()?.id === signedInCaptainId) return;
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
  /** Sales recorded on this phone that the server has not confirmed yet. */
  pendingCount: number;
  /** The server answered 401: the session ended. Queued sales wait for sign-in. */
  signedOut: boolean;
  /** Try to send queued sales now; resolves to how many are still waiting. */
  syncNow: () => Promise<number>;
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

/** IST calendar day of an instant, matching the server's "today" whatever
 *  timezone the phone is set to. */
function istDay(d: Date): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && istDay(d) === istDay(new Date());
}

/** What the captain is told when the server refuses a queued sale for good. */
function dropMessage(error: string | undefined): string {
  switch (error) {
    case "price_changed":
      return "A price changed since your product list loaded. Reload the page and capture the sale again.";
    case "not_allocated":
      return "One of the products is no longer on your list. Reload the page and capture the sale again.";
    case "invalid_mobile":
      return "The mobile number was not valid. Capture the sale again.";
    default:
      return "The sale could not be saved. Capture it again.";
  }
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
  const [pendingCount, setPendingCount] = useState(0);
  const [signedOut, setSignedOut] = useState(false);
  const flushingRef = useRef(false);
  const syncPending = useCallback(() => setPendingCount(readOutbox().length), []);

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
        setSignedOut(false);
        return "ok";
      }
      // Session ended: keep it queued. It goes up after the captain signs in
      // again (dropping it here used to lose every sale made after expiry).
      if (res.status === 401) {
        setSignedOut(true);
        return "retry";
      }
      // 5xx / 503, timeouts, rate limits: transient; keep it queued.
      if (res.status >= 500 || res.status === 408 || res.status === 429) return "retry";
      // Any other 4xx will never be accepted. Take the row off the day (it was
      // never recorded, so it must not count towards the cash to settle) and
      // tell the captain, instead of letting it vanish on the next reload.
      const data = await readJson<CaptureResponse>(res);
      dequeue(item.tempId);
      setCustomers((prev) => prev.filter((c) => c.id !== item.tempId));
      toast.error(`Sale for ${item.payload.name} was not saved`, {
        description: dropMessage(data?.error),
      });
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
      syncPending();
    }
  }, [flushOne, syncPending]);

  // Mount: instant paint from cache, then hydrate identity + today's captures,
  // then drain the outbox. The pre-auth /captain/login route skips the network.
  useEffect(() => {
    const cachedCustomers = readCache();
    if (cachedCustomers.length > 0) setCustomers(cachedCustomers);
    const cachedIdentity = readIdentityCache();
    if (cachedIdentity) setIdentity(cachedIdentity);
    syncPending();
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
          // Do NOT redirect (the Edge proxy owns auth redirects) and keep the
          // cached identity on screen; the shell shows a sign-in prompt.
          setSignedOut(true);
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
  }, [flushOutbox, syncPending]);

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
      // Unique per sale (two sales in the same millisecond used to share an id),
      // and sent as the idempotency key.
      const rand =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const tempId = `OFF-LOCAL-${rand}`;
      const record: OfflineCustomer = {
        ...input,
        id: tempId,
        capturedAt: new Date().toISOString(),
      };
      // Optimistic: show it instantly…
      setCustomers((prev) => [record, ...prev]);
      // …then queue + attempt the real POST (retried offline).
      enqueue({ tempId, payload: toPayload(input, tempId) });
      syncPending();
      void flushOutbox();
      return record;
    },
    [flushOutbox, syncPending],
  );

  const syncNow = useCallback(async () => {
    await flushOutbox();
    return readOutbox().length;
  }, [flushOutbox]);

  const value = useMemo<CaptainStore>(() => {
    const todayCustomers = customers.filter((c) => isToday(c.capturedAt));
    // Summed in paise so a day of ₹349.50 sales never shows a 0.0000001 variance.
    const sumPaise = (list: OfflineCustomer[]) =>
      list.reduce((s, c) => s + rupeesToPaise(c.total), 0);
    const gmv = paiseToRupees(sumPaise(todayCustomers));
    const cash = paiseToRupees(sumPaise(todayCustomers.filter((c) => c.payMode === "Cash")));
    const upi = paiseToRupees(sumPaise(todayCustomers.filter((c) => c.payMode === "UPI")));
    const communities =
      identity?.communities && identity.communities.length > 0 ? identity.communities : COMMUNITIES;
    return {
      captain: identity,
      pendingCount,
      signedOut,
      syncNow,
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
  }, [customers, identity, addCustomer, pendingCount, signedOut, syncNow]);

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

/** Today's community pickups (due first), or null when they could not be
 *  loaded. A failure used to look exactly like "no pickups today". */
export async function fetchCaptainPickups(): Promise<CaptainPickup[] | null> {
  try {
    const res = await fetch("/api/captain/pickups", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const data = await readJson<PickupsResponse>(res);
    if (res.ok && data?.ok && Array.isArray(data.pickups)) return data.pickups;
    return null;
  } catch {
    return null;
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
    throw new PickupUpdateError(data?.error ?? "pickup_update_failed", data?.pickup);
  }
  return data.pickup;
}

/* ── shared statics + formatters ──────────────────────────────────────────── */

/** Catalog the captain can add to a stall cart. Prices are whole RUPEES. */
/*
 * STALL_CATALOG lived here: a hardcoded six-item list the captain app sold
 * from. Not one of its SKUs existed in the catalogue — "Foxtail millet" and
 * "Mixed superfood seeds" were not products at all, and every price was
 * invented (1L groundnut oil was listed at 460 against a real 500).
 *
 * A captain taking cash against those lines recorded revenue that could not be
 * tied to a real SKU or reconciled against stock. It is deleted rather than
 * deprecated so it cannot be imported back by accident: the tray now comes from
 * captain_allocations via /api/captain/catalogue.
 */

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
 *  time is safe). Falls back to "No time set" when the pickup has no due time. */
export function formatPickupWhen(dueAt: string | null): string {
  if (!dueAt) return "No time set";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "No time set";
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
  return `${dayLabel}, ${h}:${min} ${ampm}`;
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
