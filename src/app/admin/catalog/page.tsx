"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { PRODUCTS } from "@/components/ng/data";
import { HBars } from "@/components/ng/admin/viz";
import { cn } from "@/lib/utils";
import { ProductFormDrawer } from "@/components/ng/admin/catalog/product-form-drawer";
import { CsvImportDialog } from "@/components/ng/admin/catalog/csv-import-dialog";
import { downloadCsv, productsToCsv } from "@/components/ng/admin/catalog/csv";
import { STATUS_TONE, type AdminProduct, type ProductStatus } from "@/components/ng/admin/catalog/types";

const TAG_CATEGORY: Record<string, string> = {
  oil: "Oils",
  ghee: "Ghee",
  honey: "Honey",
  millet: "Millets",
  flour: "Flours",
  superfood: "Superfoods",
  spice: "Spices",
  pulse: "Pulses",
  fruit: "Produce",
  gifting: "Gifting",
};

const STOCKS = [142, 89, 12, 31, 218, 76, 4, 56, 9, 187, 134, 24, 67, 41];
const STATUSES: ProductStatus[] = [
  "Published", "Published", "Out of stock", "Published", "Published", "Published",
  "Draft", "Published", "Published", "Published", "Published", "Draft", "Published", "Archived",
];

/** Seed the editable product list from the storefront catalog data. */
function seedProducts(): AdminProduct[] {
  return PRODUCTS.map((p, i) => {
    const tag = p.tags?.[0] ?? "";
    const mrp = p.mrp ?? p.price ?? 0;
    const price = p.price ?? 0;
    return {
      id: p.id ?? `p-${i}`,
      title: p.title,
      sku: `NG-${(p.id ?? "").replace("p-", "")}-01`,
      category: TAG_CATEGORY[tag] ?? "Other",
      price,
      mrp,
      stock: STOCKS[i] ?? 50,
      status: STATUSES[i] ?? "Published",
      lot: "",
      description: p.unit ?? "",
      rating: p.rating ?? 0,
      image: p.image,
      badge: p.badge,
    };
  });
}

const TABS = ["All products", "Published", "Drafts", "Out of stock", "Archived"];

export default function AdminCatalog() {
  // ── editable product list (demo persistence — real save = M2) ────
  const [products, setProducts] = useState<AdminProduct[]>(() => seedProducts());

  const live = products.filter((r) => r.status === "Published").length;
  const blocked = products.filter((r) => r.status === "Out of stock").length;
  const drafts = products.filter((r) => r.status === "Draft").length;

  // category counts for the mix bar
  const catRows = useMemo(() => {
    const counts = products.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [products]);

  const avgRating = products.length
    ? (products.reduce((s, r) => s + (r.rating ?? 0), 0) / products.length).toFixed(2)
    : "0.00";

  // ── form drawer + import dialog state ────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const openNew = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((p: AdminProduct) => {
    setEditing(p);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback((next: AdminProduct, mode: "create" | "edit") => {
    setProducts((prev) => {
      if (mode === "edit") return prev.map((p) => (p.id === next.id ? next : p));
      return [next, ...prev];
    });
    setFormOpen(false);
    toast.success("Product saved", {
      description: mode === "edit" ? `${next.title} updated.` : `${next.title} added to catalog.`,
    });
  }, []);

  const handleImport = useCallback((rows: AdminProduct[]) => {
    setProducts((prev) => [...rows, ...prev]);
    setImportOpen(false);
    toast.success("Products imported", {
      description: `${rows.length} row${rows.length === 1 ? "" : "s"} appended to the catalog.`,
    });
  }, []);

  const handleExport = useCallback(() => {
    const csv = productsToCsv(products);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`nutrigreenz-catalog-${stamp}.csv`, csv);
    toast.success("Export started", { description: `${products.length} products → CSV download.` });
  }, [products]);

  // ── row selection ───────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allIds = useMemo(() => products.map((r) => r.id).filter(Boolean), [products]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && selected.size < allIds.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  /** Bulk set active/draft updates the local list; export keeps selection. */
  function bulkAction(label: string) {
    if (label === "Export selected") {
      const rows = products.filter((p) => selected.has(p.id));
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`nutrigreenz-catalog-selected-${stamp}.csv`, productsToCsv(rows));
      toast.success("Export started", { description: `${rows.length} selected → CSV download.` });
      return; // keep selection
    }
    const nextStatus: ProductStatus = label === "Set active" ? "Published" : "Draft";
    setProducts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, status: nextStatus } : p)));
    toast.success(label, { description: `${selected.size} product${selected.size === 1 ? "" : "s"} affected.` });
    clearSelection();
  }

  return (
    <AdminShell
      active="/admin/catalog"
      title={
        <span>
          Product <em className="italic text-ng-clay font-display">catalog</em>
        </span>
      }
      subtitle={`${products.length} SKUs · ${live} live · ${blocked} stock-blocked · ${drafts} in draft`}
      actions={
        <>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            <Icon name="export-bold" size={15} className="text-ng-forest" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            <Icon name="import-bold" size={15} className="text-ng-forest" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="add-circle-bold" size={15} />
            New product
          </button>
        </>
      }
    >
      {/* Stat tiles + category mix */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <StatTile label="Live SKUs" value={String(live)} delta={`${products.length ? Math.round((live / products.length) * 100) : 0}% of catalog`} trend="up" />
          <StatTile label="Avg rating" value={`${avgRating}★`} delta="across all SKUs" trend="flat" />
          <StatTile label="Stock-blocked" value={String(blocked)} delta="needs restock" trend="down" />
          <StatTile label="Drafts" value={String(drafts)} delta="awaiting copy + photos" trend="flat" />
        </div>
        <Card title="Catalog by category">
          <HBars rows={catRows} tone="forest" formatValue={(v) => `${v}`} />
        </Card>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex gap-1 bg-ng-paper border border-ng-line-soft rounded-full p-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`px-4 py-1.5 rounded-full text-[12.5px] transition-colors cursor-pointer ${
                i === 0 ? "bg-ng-forest-deep text-ng-cream font-semibold" : "text-ng-ink-muted font-medium hover:text-ng-forest"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Icon name="magnifer-linear" size={15} className="text-ng-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search SKU, name, tag…"
              className="rounded-full bg-ng-paper border border-ng-line-soft pl-9 pr-4 py-2 text-[13px] font-medium w-72 focus:border-ng-forest outline-none"
            />
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-ng-line-soft px-3.5 py-2 text-[13px] font-medium text-ng-ink-muted bg-ng-paper hover:bg-ng-cream transition-colors cursor-pointer">
            <Icon name="filter-bold" size={15} className="text-ng-ink-soft" />
            Filters
          </button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {selected.size > 0 ? (
          <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-ng-forest-deep text-ng-cream">
            <span className="text-[12.5px] font-semibold">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => bulkAction("Set active")}
                className="rounded-full bg-ng-cream/10 hover:bg-ng-cream/20 px-3 py-1 text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Set active
              </button>
              <button
                type="button"
                onClick={() => bulkAction("Mark draft")}
                className="rounded-full bg-ng-cream/10 hover:bg-ng-cream/20 px-3 py-1 text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Mark draft
              </button>
              <button
                type="button"
                onClick={() => bulkAction("Export selected")}
                className="rounded-full bg-ng-cream/10 hover:bg-ng-cream/20 px-3 py-1 text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Export
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-full px-3 py-1 text-[12px] font-semibold text-ng-cream/85 hover:text-ng-cream transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-[auto_2.6fr_1fr_0.9fr_1.1fr_0.8fr_0.7fr_1fr_0.5fr] gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span className="w-4">
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              onChange={toggleAll}
              className="cursor-pointer accent-ng-forest-deep"
            />
          </span>
          <span>Product</span>
          <span>SKU</span>
          <span>Category</span>
          <span>Price</span>
          <span>Rating</span>
          <span>Stock</span>
          <span>Status</span>
          <span></span>
        </div>
        <ul>
          {products.map((r) => {
            const isSelected = selected.has(r.id);
            const margin = r.mrp > 0 && r.mrp > r.price ? Math.round(((r.mrp - r.price) / r.mrp) * 100) : 0;
            return (
            <li
              key={r.id}
              className={cn(
                "grid grid-cols-[auto_2.6fr_1fr_0.9fr_1.1fr_0.8fr_0.7fr_1fr_0.5fr] gap-4 px-6 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0 transition-colors",
                isSelected ? "bg-ng-sage/20" : "hover:bg-ng-cream/40",
              )}
            >
              <span className="w-4">
                <input
                  type="checkbox"
                  aria-label={`Select ${r.title}`}
                  checked={isSelected}
                  onChange={() => toggleRow(r.id)}
                  className="cursor-pointer accent-ng-forest-deep"
                />
              </span>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative size-11 rounded-lg overflow-hidden bg-ng-sage shrink-0">
                  <Image src={r.image} alt={r.title} fill className="object-cover" sizes="44px" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ng-ink">{r.title}</span>
                    {r.badge ? (
                      <span className="shrink-0 text-[11px] uppercase tracking-wider font-bold text-ng-clay-deep bg-ng-clay/15 rounded-full px-2 py-0.5">
                        {r.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">{r.description}</div>
                </div>
              </div>
              <span className="font-mono text-[11.5px] font-semibold text-ng-ink">{r.sku}</span>
              <span className="text-[12px] font-medium text-ng-ink-muted">{r.category}</span>
              <span>
                <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">₹{r.price.toLocaleString("en-IN")}</span>
                {margin > 0 ? (
                  <span className="block text-[11px] font-medium tabular-nums text-ng-ink-soft">
                    <span className="line-through">₹{r.mrp.toLocaleString("en-IN")}</span> · {margin}% off
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1 font-mono text-[12px] tabular-nums font-semibold text-ng-ink">
                <Icon name="star-bold" size={12} className="text-ng-clay" />
                {r.rating.toFixed(1)}
              </span>
              <span className={`font-mono text-[12px] tabular-nums ${r.stock < 20 ? "text-ng-terracotta font-semibold" : "font-semibold text-ng-ink"}`}>{r.stock}</span>
              <span><Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Pill></span>
              <button
                type="button"
                onClick={() => openEdit(r)}
                aria-label={`Edit ${r.title}`}
                className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer"
              >
                Edit →
              </button>
            </li>
            );
          })}
        </ul>

        <div className="px-6 py-3 flex items-center justify-between text-[12px] text-ng-ink-soft border-t border-ng-line-soft bg-ng-cream/40">
          <span className="text-[11.5px] font-medium tabular-nums">Showing 1–{products.length} of {products.length}</span>
          <div className="flex gap-2">
            <button type="button" className="px-3 py-1 rounded-lg border border-ng-line-soft font-medium text-ng-ink-muted hover:bg-ng-paper transition-colors cursor-pointer">← Prev</button>
            <button type="button" className="px-3 py-1 rounded-lg border border-ng-line-soft font-medium text-ng-ink-muted hover:bg-ng-paper transition-colors cursor-pointer">Next →</button>
          </div>
        </div>
      </Card>

      {/* Add / edit product form drawer (demo persistence) */}
      <ProductFormDrawer
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      {/* CSV import dialog (demo persistence) */}
      <CsvImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </AdminShell>
  );
}
