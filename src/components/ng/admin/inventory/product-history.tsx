"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The product audit log, for the whole catalog or one product.
 *
 * Every change an admin makes to a product or its variants, newest first and
 * grouped by day: who, when, and each field's old and new value. Deleted
 * products keep their history.
 */

type Action =
  | "created"
  | "updated"
  | "deleted"
  | "stock"
  | "variant_created"
  | "variant_updated"
  | "variant_deleted"
  | "variant_stock";

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

interface Entry {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  action: Action;
  changes: Change[];
  actorEmail: string | null;
  actorRole: string | null;
  source: "admin" | "import";
  createdAt: string;
}

type Kind = "all" | "price" | "stock" | "details" | "variants" | "added-removed";
type Window = "all" | "24h" | "7d" | "30d";

const KINDS: { key: Kind; label: string }[] = [
  { key: "all", label: "All changes" },
  { key: "price", label: "Price" },
  { key: "stock", label: "Stock" },
  { key: "details", label: "Details" },
  { key: "variants", label: "Variants" },
  { key: "added-removed", label: "Added & deleted" },
];

const WINDOWS: { key: Window; label: string; ms: number | null }[] = [
  { key: "all", label: "All time", ms: null },
  { key: "24h", label: "Last 24 hours", ms: 86_400_000 },
  { key: "7d", label: "Past week", ms: 7 * 86_400_000 },
  { key: "30d", label: "Past month", ms: 30 * 86_400_000 },
];

const ACTION: Record<Action, { label: string; icon: string; tone: "success" | "neutral" | "warn" | "danger" }> = {
  created: { label: "Product added", icon: "add-circle-bold", tone: "success" },
  updated: { label: "Product edited", icon: "pen-2-bold", tone: "neutral" },
  deleted: { label: "Product deleted", icon: "trash-bin-trash-bold", tone: "danger" },
  stock: { label: "Stock changed", icon: "box-bold", tone: "warn" },
  variant_created: { label: "Variant added", icon: "layers-minimalistic-bold", tone: "success" },
  variant_updated: { label: "Variant edited", icon: "layers-minimalistic-bold", tone: "neutral" },
  variant_deleted: { label: "Variant deleted", icon: "trash-bin-trash-bold", tone: "danger" },
  variant_stock: { label: "Variant stock changed", icon: "box-bold", tone: "warn" },
};

const FIELD: Record<string, string> = {
  name: "Name",
  status: "Status",
  pricePaise: "Price",
  stock: "Stock",
  reserved: "Reserved",
  categoryName: "Category",
  sku: "SKU",
  slug: "Web address",
  description: "Description",
  imageUrl: "Main image",
  gallery: "Gallery",
  label: "Variant name",
  isActive: "Shown in store",
  pack: "Pack",
  sizeValue: "Size",
  sizeUnit: "Unit",
  sort: "Display order",
};

const ERRORS: Record<string, string> = {
  "setup-pending": "Product history starts once its database table exists. Run the product audit SQL.",
};

export function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "none";
  if (field === "pricePaise" && typeof v === "number") {
    return `₹${(v / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (field === "gallery" && Array.isArray(v)) return `${v.length} image${v.length === 1 ? "" : "s"}`;
  if (field === "imageUrl") return "an image";
  if (typeof v === "number") return v.toLocaleString("en-IN");
  return String(v);
}

/** One line per field: "Price ₹250 → ₹270", or what a new product started with. */
function ChangeLine({ c, created }: { c: Change; created: boolean }) {
  const name = FIELD[c.field] ?? c.field;
  const long = c.field === "description";
  if (c.field === "imageUrl") {
    return (
      <li className="text-[13.5px] text-ng-ink">
        <span className="font-semibold">{name}</span>{" "}
        {c.from === null ? "added" : c.to === null ? "removed" : "replaced"}
      </li>
    );
  }
  if (created) {
    return (
      <li className="text-[13.5px] text-ng-ink">
        <span className="font-semibold">{name}</span> {formatValue(c.field, c.to)}
      </li>
    );
  }
  if (long) {
    return (
      <li className="text-[13.5px] text-ng-ink">
        <span className="font-semibold">{name}</span> rewritten
        <span className="mt-0.5 block text-[12.5px] text-ng-ink-muted line-clamp-2 [overflow-wrap:anywhere]">
          Now: {formatValue(c.field, c.to)}
        </span>
      </li>
    );
  }
  return (
    <li className="text-[13.5px] text-ng-ink [overflow-wrap:anywhere]">
      <span className="font-semibold">{name}</span>{" "}
      <span className="text-ng-ink-muted line-through decoration-ng-ink-soft/60">{formatValue(c.field, c.from)}</span>
      <span className="mx-1.5 text-ng-ink-soft" aria-hidden>
        →
      </span>
      <span className="sr-only"> changed to </span>
      <span className="font-semibold text-ng-forest-deep">{formatValue(c.field, c.to)}</span>
    </li>
  );
}

const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function ProductHistoryList({ productId, compact = false }: { productId?: string; compact?: boolean }) {
  const [kind, setKind] = useState<Kind>("all");
  const [win, setWin] = useState<Window>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; entries: Entry[]; error: string | null } | null>(null);
  const [older, setOlder] = useState<Entry[]>([]);
  const [moreState, setMoreState] = useState<"idle" | "loading" | "end">("idle");
  const key = `${productId ?? ""}|${kind}|${win}|${reloadKey}`;

  // Built when fetching, not while rendering: the time window reads the clock.
  const buildParams = useCallback(() => {
    const q = new URLSearchParams({ kind });
    if (productId) q.set("productId", productId);
    const ms = WINDOWS.find((w) => w.key === win)?.ms;
    if (ms) q.set("since", new Date(Date.now() - ms).toISOString());
    return q;
  }, [productId, kind, win]);
  const [lastParams, setLastParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    let alive = true;
    const params = buildParams();
    void fetch(`/api/admin/inventory/history?${params}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; entries?: Entry[]; error?: string };
        if (!alive) return;
        setLastParams(params);
        setOlder([]);
        setMoreState((j.entries?.length ?? 0) < 100 ? "end" : "idle");
        setResult({ key, entries: j.ok ? j.entries ?? [] : [], error: j.ok ? null : j.error ?? "unavailable" });
      })
      .catch(() => alive && setResult({ key, entries: [], error: "unavailable" }));
    return () => {
      alive = false;
    };
  }, [buildParams, key]);

  const loading = result?.key !== key;
  const all = useMemo(() => [...(result?.entries ?? []), ...older], [result, older]);
  const term = search.trim().toLowerCase();
  const shown = term
    ? all.filter(
        (e) =>
          e.productName.toLowerCase().includes(term) ||
          (e.variantLabel ?? "").toLowerCase().includes(term) ||
          (e.actorEmail ?? "").toLowerCase().includes(term),
      )
    : all;

  const groups = useMemo(() => {
    const out: { day: string; items: Entry[] }[] = [];
    for (const e of shown) {
      const d = dayKey(e.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === d) last.items.push(e);
      else out.push({ day: d, items: [e] });
    }
    return out;
  }, [shown]);

  async function loadOlder() {
    const last = all[all.length - 1];
    if (!last) return;
    setMoreState("loading");
    const q = new URLSearchParams(lastParams ?? buildParams());
    q.set("before", last.createdAt);
    try {
      const r = await fetch(`/api/admin/inventory/history?${q}`, { cache: "no-store" });
      const j = (await r.json()) as { ok?: boolean; entries?: Entry[] };
      const got = j.entries ?? [];
      setOlder((o) => [...o, ...got]);
      setMoreState(got.length < 100 ? "end" : "idle");
    } catch {
      setMoreState("idle");
    }
  }

  const chip = (on: boolean) =>
    cn(
      "min-h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
      on ? "border-ng-forest bg-ng-forest text-ng-cream" : "border-ng-line bg-ng-paper text-ng-ink hover:border-ng-leaf",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Kind of change" className="flex flex-wrap gap-2">
          {KINDS.filter((k) => !(productId && k.key === "added-removed")).map((k) => (
            <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)} className={chip(kind === k.key)}>
              {k.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Time window"
          value={win}
          onChange={(e) => setWin(e.target.value as Window)}
          className="h-9 rounded-full border border-ng-line bg-ng-paper px-3 text-[13px] font-semibold text-ng-ink outline-none focus:border-ng-forest cursor-pointer"
        >
          {WINDOWS.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </select>
        {!productId ? (
          <label className="relative ml-auto w-full sm:w-64">
            <span className="sr-only">Search product or person</span>
            <Icon name="magnifer-bold" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ng-ink-soft" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product or person"
              className="h-9 w-full rounded-full border border-ng-line bg-ng-paper pl-8 pr-3 text-[13px] text-ng-ink outline-none focus:border-ng-forest"
            />
          </label>
        ) : null}
      </div>

      {result?.error && !loading ? (
        <p className="rounded-2xl border border-ng-danger/40 bg-ng-danger/5 p-4 text-[14px] text-ng-danger">
          {ERRORS[result.error] ?? "Product history didn't load."}{" "}
          {!ERRORS[result.error] ? (
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline cursor-pointer">
              Try again
            </button>
          ) : null}
        </p>
      ) : loading ? (
        <div aria-busy="true" className="h-32 rounded-2xl border border-ng-line-soft bg-ng-paper motion-safe:animate-pulse" />
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ng-line-soft px-4 py-6 text-center text-[14px] text-ng-ink-muted">
          No changes recorded{win !== "all" ? " in this period" : ""} yet. Every change from now on appears here.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.day}>
              <h3 className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-ng-ink-soft">{g.day}</h3>
              <ul className="divide-y divide-ng-line-soft rounded-2xl border border-ng-line-soft bg-ng-paper">
                {g.items.map((e) => {
                  const a = ACTION[e.action] ?? ACTION.updated;
                  const created = e.action === "created" || e.action === "variant_created";
                  return (
                    <li key={e.id} className={cn("flex gap-3", compact ? "p-3.5" : "p-4")}>
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ng-sage/40 text-ng-forest-deep">
                        <Icon name={a.icon} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {!productId ? (
                            <span className="text-[15px] font-semibold text-ng-ink [overflow-wrap:anywhere]">{e.productName}</span>
                          ) : null}
                          {e.variantLabel ? (
                            <span className="text-[13.5px] font-semibold text-ng-clay-deep">{e.variantLabel}</span>
                          ) : null}
                          <Pill tone={a.tone}>{a.label}</Pill>
                          {e.source === "import" ? <Pill tone="neutral">CSV import</Pill> : null}
                        </div>
                        {e.changes.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {e.changes.map((c) => (
                              <ChangeLine key={c.field} c={c} created={created} />
                            ))}
                          </ul>
                        ) : null}
                        <div className="mt-1.5 text-[12.5px] text-ng-ink-muted">
                          {time(e.createdAt)} · {e.actorEmail ?? "Unknown admin"}
                          {e.actorRole === "superadmin" ? " (Super Admin)" : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {moreState !== "end" ? (
            <div className="text-center">
              <button
                type="button"
                disabled={moreState === "loading"}
                onClick={() => void loadOlder()}
                className="rounded-full border border-ng-line px-5 py-2 text-[13px] font-semibold text-ng-ink hover:bg-ng-cream transition-colors cursor-pointer disabled:opacity-50"
              >
                {moreState === "loading" ? "Loading…" : "Show older changes"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One product's history, in a side panel over the inventory page. */
export function ProductHistoryDrawer({
  product,
  onClose,
}: {
  product: { id: string; name: string } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product, onClose]);

  if (!product || typeof document === "undefined") return null;
  // Portaled to the admin root: the shell header's backdrop-filter would
  // otherwise pin a fixed panel to the page instead of the screen.
  const host = document.querySelector<HTMLElement>(".ng-admin") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`History of ${product.name}`}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-ng-forest-deep/30 backdrop-blur-[1px]"
      />
      <aside className="relative h-dvh w-full max-w-3xl overflow-y-auto overscroll-contain border-l border-ng-line-soft bg-ng-cream shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ng-line-soft bg-ng-cream/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-ng-ink-muted">Product history</div>
            <div className="font-display text-[22px] leading-tight text-ng-forest-deep line-clamp-2 [overflow-wrap:anywhere]">
              {product.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="grid size-10 shrink-0 place-items-center rounded-full text-ng-ink hover:bg-ng-paper cursor-pointer"
          >
            <Icon name="close-circle-bold" size={22} />
          </button>
        </header>
        <div className="px-5 py-5 sm:px-7">
          <ProductHistoryList key={product.id} productId={product.id} compact />
        </div>
      </aside>
    </div>,
    host,
  );
}
