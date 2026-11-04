"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { downloadCsv, type CsvRow } from "@/components/ng/admin/reports/csv";
import { cn } from "@/lib/utils";

/**
 * Who saved what: every customer with a wishlist and the products on it, or
 * every saved product and the customers who saved it. With their contact
 * details, so the team can follow up (a restock, an offer, a reminder).
 */

interface SavedItem {
  slug: string;
  title: string;
  image: string;
  href: string;
  pricePaise: number;
  savedAt: string;
}

interface Saver {
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  items: SavedItem[];
  lastSavedAt: string;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const initials = (s: Saver) =>
  (s.name || s.email || s.phone || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

function Contact({ s }: { s: Saver }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ng-ink-muted">
      {s.phone ? (
        <a href={`tel:${s.phone}`} className="hover:text-ng-forest-deep hover:underline tabular-nums">
          {s.phone}
        </a>
      ) : null}
      {s.email ? (
        <a href={`mailto:${s.email}`} className="hover:text-ng-forest-deep hover:underline [overflow-wrap:anywhere]">
          {s.email}
        </a>
      ) : null}
      {!s.phone && !s.email ? <span>No contact on file</span> : null}
    </div>
  );
}

function Thumb({ item }: { item: SavedItem }) {
  return item.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- small catalogue thumbnails
    <img src={item.image} alt="" className="size-9 shrink-0 rounded-lg border border-ng-line-soft object-cover bg-ng-cream" />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ng-cream text-ng-clay-deep">
      <Icon name="heart-bold" size={14} />
    </span>
  );
}

export function WishlistSavers() {
  const [savers, setSavers] = useState<Saver[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"customers" | "products">("customers");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    void fetch("/api/admin/wishlists?view=savers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { savers?: Saver[] } | null) => {
        if (!alive) return;
        if (j?.savers) setSavers(j.savers);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const term = search.trim().toLowerCase();
  const matchesSaver = (s: Saver) =>
    !term ||
    [s.name, s.email, s.phone].some((v) => (v ?? "").toLowerCase().includes(term)) ||
    s.items.some((i) => i.title.toLowerCase().includes(term));

  const customers = useMemo(() => (savers ?? []).filter(matchesSaver), [savers, term]); // eslint-disable-line react-hooks/exhaustive-deps

  const products = useMemo(() => {
    const map = new Map<string, { item: SavedItem; who: { saver: Saver; savedAt: string }[] }>();
    for (const s of savers ?? []) {
      for (const it of s.items) {
        const entry = map.get(it.slug) ?? { item: it, who: [] };
        entry.who.push({ saver: s, savedAt: it.savedAt });
        map.set(it.slug, entry);
      }
    }
    return [...map.values()]
      .map((e) => ({ ...e, who: e.who.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) }))
      .filter(
        (e) =>
          !term ||
          e.item.title.toLowerCase().includes(term) ||
          e.who.some(({ saver }) => [saver.name, saver.email, saver.phone].some((v) => (v ?? "").toLowerCase().includes(term))),
      )
      .sort((a, b) => b.who.length - a.who.length || a.item.title.localeCompare(b.item.title));
  }, [savers, term]);

  function exportCsv() {
    const rows: CsvRow[] = [];
    for (const s of savers ?? []) {
      for (const it of s.items) {
        rows.push({
          Customer: s.name ?? "",
          Phone: s.phone ?? "",
          Email: s.email ?? "",
          Product: it.title,
          "Saved on": day(it.savedAt),
        });
      }
    }
    downloadCsv("wishlists-who-saved-what", rows, ["Customer", "Phone", "Email", "Product", "Saved on"]);
  }

  const chip = (on: boolean) =>
    cn(
      "min-h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors cursor-pointer",
      on ? "border-ng-forest bg-ng-forest text-ng-cream" : "border-ng-line bg-ng-paper text-ng-ink hover:border-ng-leaf",
    );

  return (
    <Card
      title="Who saved what"
      action={
        <button
          type="button"
          onClick={exportCsv}
          disabled={!savers || savers.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-ng-line px-3.5 py-1.5 text-[12px] font-semibold text-ng-ink hover:bg-ng-paper disabled:opacity-50 cursor-pointer"
        >
          <Icon name="save" size={14} className="text-ng-forest" />
          Download list
        </button>
      }
    >
      <p className="-mt-1 mb-4 text-[13px] text-ng-ink-muted">
        Each customer and the products on their wishlist, with their contact details for a follow-up.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex gap-2">
          <button type="button" aria-pressed={view === "customers"} onClick={() => setView("customers")} className={chip(view === "customers")}>
            By customer
          </button>
          <button type="button" aria-pressed={view === "products"} onClick={() => setView("products")} className={chip(view === "products")}>
            By product
          </button>
        </div>
        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Search customer or product</span>
          <Icon name="magnifer-bold" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ng-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, phone, email or product"
            className="h-9 w-full rounded-full border border-ng-line bg-ng-paper pl-8 pr-3 text-[13px] text-ng-ink outline-none focus:border-ng-forest"
          />
        </label>
      </div>

      {failed ? (
        <p className="rounded-2xl border border-ng-danger/40 bg-ng-danger/5 p-4 text-[14px] text-ng-danger">
          The wishlist list didn&rsquo;t load. Refresh the page to try again.
        </p>
      ) : !savers ? (
        <div aria-busy="true" className="h-32 rounded-2xl border border-ng-line-soft bg-ng-paper motion-safe:animate-pulse" />
      ) : savers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ng-line-soft px-4 py-6 text-center text-[14px] text-ng-ink-muted">
          No customer has saved a product yet.
        </p>
      ) : view === "customers" ? (
        customers.length === 0 ? (
          <p className="px-1 py-4 text-[14px] text-ng-ink-muted">Nobody matches &ldquo;{search}&rdquo;.</p>
        ) : (
          <ul className="divide-y divide-ng-line-soft rounded-2xl border border-ng-line-soft bg-ng-paper">
            {customers.map((s) => (
              <li key={s.customerId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ng-sage/40 font-display text-[14px] text-ng-forest-deep">
                      {initials(s)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-ng-ink [overflow-wrap:anywhere]">{s.name || "Customer"}</div>
                      <Contact s={s} />
                    </div>
                  </div>
                  <div className="text-right text-[12.5px] text-ng-ink-muted">
                    <div className="font-semibold text-ng-forest-deep">
                      {s.items.length} saved
                    </div>
                    <div>last on {day(s.lastSavedAt)}</div>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.items.map((it) => (
                    <li key={it.slug}>
                      <a
                        href={it.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-ng-line-soft bg-ng-cream/40 py-1.5 pl-1.5 pr-3 hover:border-ng-leaf"
                        title={`Saved on ${day(it.savedAt)}`}
                      >
                        <Thumb item={it} />
                        <span className="min-w-0">
                          <span className="block max-w-[220px] truncate text-[13px] font-semibold text-ng-ink">{it.title}</span>
                          <span className="block text-[11.5px] text-ng-ink-muted">saved {day(it.savedAt)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      ) : products.length === 0 ? (
        <p className="px-1 py-4 text-[14px] text-ng-ink-muted">Nothing matches &ldquo;{search}&rdquo;.</p>
      ) : (
        <ul className="divide-y divide-ng-line-soft rounded-2xl border border-ng-line-soft bg-ng-paper">
          {products.map(({ item, who }) => (
            <li key={item.slug} className="p-4">
              <div className="flex items-center gap-3">
                <Thumb item={item} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ng-ink">{item.title}</div>
                  <div className="text-[12.5px] text-ng-ink-muted">
                    Saved by {who.length} customer{who.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {who.map(({ saver, savedAt }) => (
                  <li key={saver.customerId} className="rounded-xl border border-ng-line-soft bg-ng-cream/40 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-ng-ink">{saver.name || "Customer"}</span>
                      <span className="shrink-0 text-[11.5px] text-ng-ink-muted">{day(savedAt)}</span>
                    </div>
                    <Contact s={saver} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
