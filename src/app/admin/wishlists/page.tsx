"use client";

/**
 * Admin · Wishlists — which products customers have saved but not yet bought,
 * as a live demand / restock signal.
 *
 * Every figure is real: it is driven entirely by `GET /api/admin/wishlists`,
 * which aggregates `public.wishlists` (a durable, customer-scoped table) into
 * headline totals plus the top saved products ranked by distinct saver count,
 * each hydrated from the live catalogue. Money is integer paise throughout.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import type { WishlistReport } from "@/lib/wishlist-store";
import { downloadCsv, type CsvRow } from "@/components/ng/admin/reports/csv";

/** Integer paise → a whole-rupee "₹1,234" string. */
const INR = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/** Demand tier relative to the most-saved product, for the badge. */
function demandTone(ratio: number): "warn" | "success" | "neutral" {
  if (ratio >= 0.66) return "warn"; // hot — watch stock
  if (ratio >= 0.33) return "success";
  return "neutral";
}
function demandLabel(ratio: number): string {
  if (ratio >= 0.66) return "High demand";
  if (ratio >= 0.33) return "Steady";
  return "Niche";
}

export default function AdminWishlists() {
  const [report, setReport] = useState<WishlistReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/wishlists?limit=20");
    const data = (await res.json()) as { ok: boolean; report?: WishlistReport };
    if (data.ok && data.report) setReport(data.report);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const top = report?.topProducts ?? [];
  const maxSavers = top[0]?.savers ?? 0;
  const topProduct = top[0];

  const exportCsv = useMemo(
    () => () => {
      if (!report) return;
      const rows: CsvRow[] = report.topProducts.map((p, i) => ({
        Rank: i + 1,
        Product: p.title,
        Slug: p.slug,
        Savers: p.savers,
        "Price (INR)": Math.round(p.pricePaise / 100),
      }));
      downloadCsv("wishlists-most-saved", rows, ["Rank", "Product", "Slug", "Savers", "Price (INR)"]);
    },
    [report],
  );

  return (
    <AdminShell
      active="/admin/wishlists"
      title={
        <span>
          Wishlists <em className="italic text-ng-clay font-display">&amp; saved items</em>
        </span>
      }
      subtitle="What customers have hearted but not yet bought — your live demand & restock signal"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          disabled={!report || report.topProducts.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="diskette-bold" size={15} className="text-ng-forest" />
          Export CSV
        </button>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Customers wishlisting" value={(report?.distinctSavers ?? 0).toLocaleString("en-IN")} delta="with at least one save" trend="up" />
        <StatTile label="Items saved" value={(report?.totalSaves ?? 0).toLocaleString("en-IN")} delta="across the catalogue" trend="up" />
        <StatTile label="Products saved" value={(report?.distinctProducts ?? 0).toLocaleString("en-IN")} delta="distinct SKUs" trend="up" />
        <StatTile label="Most-saved" value={topProduct ? "#1" : "—"} delta={topProduct?.title ?? "no saves yet"} trend="flat" />
      </div>

      {/* Most-wishlisted products */}
      <Card
        title="Most-wishlisted products"
        action={<span className="hidden sm:inline text-[11.5px] font-medium text-ng-ink-soft">Ranked by distinct savers</span>}
        className="!p-0 overflow-hidden mb-6"
      >
        {!report || report.topProducts.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] font-medium text-ng-ink-muted">
            {loading ? "Loading wishlist demand…" : "No products have been wishlisted yet."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[0.4fr_2.6fr_0.9fr_1.6fr_1fr_0.9fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
              <span>#</span>
              <span>Product</span>
              <span>Savers</span>
              <span>Share</span>
              <span>Demand</span>
              <span>Price</span>
            </div>
            <ul>
              {top.map((p, i) => {
                const ratio = maxSavers > 0 ? p.savers / maxSavers : 0;
                const share =
                  (report.distinctSavers ?? 0) > 0
                    ? Math.round((p.savers / report.distinctSavers) * 1000) / 10
                    : 0;
                return (
                  <li
                    key={p.slug}
                    className="grid grid-cols-[0.4fr_2.6fr_0.9fr_1.6fr_1fr_0.9fr] gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                  >
                    <span className="font-display text-[15px] text-ng-clay-deep tabular-nums">{i + 1}</span>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ng-clay/10 text-ng-clay-deep">
                        <Icon name="heart-bold" size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-ng-ink">{p.title}</div>
                        <div className="font-mono text-[11px] font-medium text-ng-ink-soft truncate">{p.slug}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">{p.savers}</span>
                    <span className="flex items-center gap-2.5">
                      <span className="font-mono text-[12px] tabular-nums font-medium text-ng-ink-muted w-12">{share}%</span>
                      <span className="h-2 flex-1 rounded-full bg-ng-line-soft overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-ng-clay"
                          style={{ width: `${Math.max(6, ratio * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span><Pill tone={demandTone(ratio)}>{demandLabel(ratio)}</Pill></span>
                    <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-ink">{INR(p.pricePaise)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </AdminShell>
  );
}
