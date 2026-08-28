"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAdminRole } from "@/lib/admin-auth";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { StockMeter } from "@/components/ng/admin/viz";
import { ProductModal, type ProductDraft } from "./product-modal";
import { CategoryModal } from "./category-modal";
import { ImportModal } from "./import-modal";
import { VariantModal } from "./variant-modal";
import { VariantImportModal } from "./variant-import-modal";
import {
  formatPaise,
  STATUS_TONE,
  type Category,
  type Product,
  type ProductStatus,
} from "./types";

const LOW_STOCK_THRESHOLD = 20;

type StatusFilter = "all" | ProductStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All products" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
];

async function postJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Super-admin gate (UI mirror of the server rules). Read from the readable
  // `ng_admin_role` cookie after mount to avoid a hydration mismatch; until then
  // we treat the operator as a plain admin so restricted controls stay hidden.
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => {
    setIsSuper(getAdminRole() === "superadmin");
  }, []);

  // ── modal state ───────────────────────────────────────────────────
  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // ── variant management ────────────────────────────────────────────
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [variantImportOpen, setVariantImportOpen] = useState(false);

  // ── inline stock edit ─────────────────────────────────────────────
  const [stockEditId, setStockEditId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState("");

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/admin/inventory/categories");
    const data = (await res.json()) as { ok: boolean; categories: Category[] };
    if (data.ok) setCategories(data.categories);
  }, []);

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    params.set("pageSize", "200");
    const res = await fetch(`/api/admin/inventory/products?${params.toString()}`);
    const data = (await res.json()) as { ok: boolean; products: Product[] };
    if (data.ok) setProducts(data.products);
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      void loadProducts().finally(() => {
        if (active) setLoading(false);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [loadProducts]);

  const stats = useMemo(() => {
    // Variant-backed products carry their stock on the variants, so roll those up;
    // base-only products keep their own stock. Keeps the tiles truthful.
    const eff = (p: Product) => ((p.variantCount ?? 0) > 0 ? p.variantStock ?? 0 : p.stock);
    const total = products.length;
    const active = products.filter((p) => p.status === "active").length;
    const low = products.filter((p) => {
      const s = eff(p);
      return s > 0 && s <= LOW_STOCK_THRESHOLD;
    }).length;
    const out = products.filter((p) => eff(p) <= 0).length;
    return { total, active, low, out };
  }, [products]);

  // ── product create / edit ─────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setProductOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setProductOpen(true);
  };

  const saveProduct = useCallback(
    async (draft: ProductDraft) => {
      setSaving(true);
      const payload = {
        name: draft.name.trim(),
        sku: draft.sku.trim() || null,
        categoryId: draft.categoryId || null,
        // Price is super-admin-only: a plain admin never sends it (the server
        // would 403 a PATCH that carries a price, and defaults it to 0 on create).
        ...(isSuper ? { pricePaise: Math.round((Number(draft.priceRupees) || 0) * 100) } : {}),
        stock: Math.max(0, Math.round(Number(draft.stock) || 0)),
        status: draft.status,
        description: draft.description.trim() || null,
        imageUrl: draft.imageUrl.trim() || null,
        gallery: draft.gallery.map((u) => u.trim()).filter(Boolean),
      };
      try {
        if (editing) {
          await postJson(`/api/admin/inventory/products/${editing.id}`, "PATCH", payload);
          await postJson(`/api/admin/inventory/products/${editing.id}/stock`, "PUT", {
            stock: payload.stock,
          });
          toast.success("Product updated", { description: payload.name });
        } else {
          await postJson("/api/admin/inventory/products", "POST", payload);
          toast.success("Product created", { description: payload.name });
        }
        setProductOpen(false);
        await loadProducts();
      } catch {
        toast.error("Could not save product", { description: "Please try again." });
      } finally {
        setSaving(false);
      }
    },
    [editing, isSuper, loadProducts],
  );

  const removeProduct = useCallback(
    async (p: Product) => {
      try {
        await postJson(`/api/admin/inventory/products/${p.id}`, "DELETE", {});
        toast.success("Product removed", { description: p.name });
        await loadProducts();
      } catch {
        toast.error("Could not remove product");
      }
    },
    [loadProducts],
  );

  // ── inline stock ──────────────────────────────────────────────────
  const startStockEdit = (p: Product) => {
    setStockEditId(p.id);
    setStockDraft(String(p.stock));
  };
  const commitStock = useCallback(
    async (p: Product) => {
      const next = Math.max(0, Math.round(Number(stockDraft) || 0));
      setStockEditId(null);
      if (next === p.stock) return;
      try {
        await postJson(`/api/admin/inventory/products/${p.id}/stock`, "PUT", { stock: next });
        setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
        toast.success("Stock updated", { description: `${p.name} → ${next}` });
      } catch {
        toast.error("Could not update stock");
      }
    },
    [stockDraft],
  );

  // ── categories ────────────────────────────────────────────────────
  const createCategory = useCallback(
    async (draft: { name: string; icon: string | null; imageUrl: string | null }) => {
      setCategoryBusy(true);
      try {
        await postJson("/api/admin/inventory/categories", "POST", draft);
        await loadCategories();
        toast.success("Category added", { description: draft.name });
      } catch {
        toast.error("Could not add category");
      } finally {
        setCategoryBusy(false);
      }
    },
    [loadCategories],
  );
  const renameCategory = useCallback(
    async (
      id: string,
      draft: { name: string; icon: string | null; imageUrl: string | null },
    ) => {
      setCategoryBusy(true);
      try {
        await postJson(`/api/admin/inventory/categories/${id}`, "PATCH", draft);
        await loadCategories();
        await loadProducts();
      } catch {
        toast.error("Could not save category");
      } finally {
        setCategoryBusy(false);
      }
    },
    [loadCategories, loadProducts],
  );
  const deleteCategory = useCallback(
    async (id: string) => {
      setCategoryBusy(true);
      try {
        await postJson(`/api/admin/inventory/categories/${id}`, "DELETE", {});
        await loadCategories();
        await loadProducts();
        toast.success("Category removed");
      } catch {
        toast.error("Could not remove category");
      } finally {
        setCategoryBusy(false);
      }
    },
    [loadCategories, loadProducts],
  );

  return (
    <AdminShell
      active="/admin/inventory"
      title={
        <span>
          Inventory <em className="italic text-ng-clay font-display">&amp; catalog</em>
        </span>
      }
      subtitle="Manage products, stock and categories from one place."
      actions={
        <>
          {isSuper && (
            <button
              type="button"
              onClick={() => setCategoryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
            >
              <UiIcon name="category" size={15} className="text-ng-forest" />
              Categories
            </button>
          )}
          {isSuper && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
            >
              <UiIcon name="import" size={15} className="text-ng-forest" />
              Import CSV
            </button>
          )}
          <a
            href="/api/admin/inventory/export"
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            <UiIcon name="export" size={15} className="text-ng-forest" />
            Export CSV
          </a>
          {isSuper && (
            <button
              type="button"
              onClick={() => setVariantImportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
            >
              <UiIcon name="import" size={15} className="text-ng-clay" />
              Import variants
            </button>
          )}
          <a
            href="/api/admin/inventory/variants/export"
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            <UiIcon name="export" size={15} className="text-ng-clay" />
            Export variants
          </a>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="add-circle-bold" size={15} />
            Add product
          </button>
        </>
      }
    >
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Products" value={String(stats.total)} />
        <StatTile label="Active" value={String(stats.active)} />
        <StatTile label="Low stock" value={String(stats.low)} delta="≤ 20 units" trend={stats.low > 0 ? "down" : "flat"} />
        <StatTile label="Out of stock" value={String(stats.out)} delta={stats.out > 0 ? "needs restock" : "all stocked"} trend={stats.out > 0 ? "down" : "up"} />
      </div>

      {/* Product table */}
      <Card title="Products" className="!p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center gap-2 flex-wrap border-b border-ng-line-soft">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] transition-colors cursor-pointer ${
                statusFilter === f.key
                  ? "bg-ng-forest-deep text-ng-cream font-semibold"
                  : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted font-medium hover:bg-ng-cream"
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-1.5 rounded-full text-[12px] bg-ng-paper border border-ng-line-soft text-ng-ink-muted font-medium outline-none focus:border-ng-forest cursor-pointer"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="relative w-full sm:ml-auto sm:w-auto">
            <UiIcon name="search" size={15} className="text-ng-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU…"
              className="rounded-full bg-ng-paper border border-ng-line-soft pl-9 pr-4 py-1.5 text-[12.5px] w-full sm:w-64 outline-none focus:border-ng-forest"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-3 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span>Product</span>
          <span>SKU</span>
          <span>Category</span>
          <span className="text-right">Price</span>
          <span>Stock level</span>
          <span className="text-center">Status</span>
          <span></span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-[13px] font-medium text-ng-ink-muted">Loading…</div>
        ) : products.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] font-medium text-ng-ink-muted">
            No products match. Add one to get started.
          </div>
        ) : (
          <ul>
            {products.map((p) => {
              const hasVariants = (p.variantCount ?? 0) > 0;
              const eStock = hasVariants ? p.variantStock ?? 0 : p.stock;
              const tone = eStock <= 0 ? "neutral" : eStock <= LOW_STOCK_THRESHOLD ? "danger" : "success";
              const label = eStock <= 0 ? "Out" : eStock <= LOW_STOCK_THRESHOLD ? "Low" : "OK";
              return (
                <li
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-3 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors"
                >
                  <span className="truncate font-semibold text-ng-ink">{p.name}</span>
                  <span className="font-mono text-[11.5px] font-medium text-ng-ink-muted truncate">{p.sku ?? "—"}</span>
                  <span className="text-[12px] font-medium text-ng-ink-muted truncate">{p.categoryName ?? "—"}</span>
                  <span className="font-mono text-[12px] tabular-nums text-ng-ink text-right whitespace-nowrap">
                    {hasVariants
                      ? p.variantMinPricePaise === p.variantMaxPricePaise
                        ? formatPaise(p.variantMinPricePaise ?? 0)
                        : `from ${formatPaise(p.variantMinPricePaise ?? 0)}`
                      : formatPaise(p.pricePaise)}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    {hasVariants ? (
                      // Stock is held per variant — surface the roll-up and send edits
                      // to the Variants manager rather than the (unused) base stock.
                      <button
                        type="button"
                        onClick={() => setVariantProduct(p)}
                        aria-label={`Manage stock via variants for ${p.name}`}
                        title="Stock is managed per variant · open Variants to edit"
                        className="flex items-center gap-2 cursor-pointer text-left"
                      >
                        <StockMeter stock={eStock} threshold={LOW_STOCK_THRESHOLD} />
                        <Pill tone={tone}>{label}</Pill>
                        <span className="whitespace-nowrap text-[10.5px] font-medium text-ng-ink-soft">
                          {p.variantCount} variants
                        </span>
                      </button>
                    ) : stockEditId === p.id ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={stockDraft}
                        onChange={(e) => setStockDraft(e.target.value)}
                        onBlur={() => void commitStock(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitStock(p);
                          if (e.key === "Escape") setStockEditId(null);
                        }}
                        className="w-20 rounded-lg bg-ng-paper border border-ng-forest px-2 py-1 text-[12.5px] font-mono tabular-nums outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startStockEdit(p)}
                        aria-label={`Edit stock for ${p.name}`}
                        className="flex items-center gap-2 cursor-pointer text-left"
                      >
                        <StockMeter stock={eStock} threshold={LOW_STOCK_THRESHOLD} />
                        <Pill tone={tone}>{label}</Pill>
                      </button>
                    )}
                  </div>
                  <span className="text-center"><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></span>
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setVariantProduct(p)}
                      aria-label={`Manage variants for ${p.name}`}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-clay-deep hover:text-ng-clay transition-colors cursor-pointer"
                    >
                      <Icon name="layers-minimalistic-bold" size={13} />
                      Variants
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-forest hover:text-ng-leaf transition-colors cursor-pointer"
                    >
                      <UiIcon name="edit" size={13} />
                      Edit
                    </button>
                    {isSuper && (
                      <button
                        type="button"
                        onClick={() => void removeProduct(p)}
                        aria-label={`Delete ${p.name}`}
                        className="text-ng-terracotta hover:text-ng-terracotta/80 transition-colors cursor-pointer"
                      >
                        <Icon name="trash-bin-trash-bold" size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
          </div>
        </div>
      </Card>

      <ProductModal
        key={productOpen ? (editing?.id ?? "new") : "closed"}
        open={productOpen}
        product={editing}
        categories={categories}
        saving={saving}
        isSuper={isSuper}
        onClose={() => setProductOpen(false)}
        onSave={saveProduct}
      />
      <CategoryModal
        open={categoryOpen}
        categories={categories}
        busy={categoryBusy}
        onClose={() => setCategoryOpen(false)}
        onCreate={createCategory}
        onRename={renameCategory}
        onDelete={deleteCategory}
      />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCommitted={() => void loadProducts()}
      />
      <VariantModal
        open={variantProduct !== null}
        product={variantProduct}
        isSuper={isSuper}
        onClose={() => setVariantProduct(null)}
        onChanged={() => void loadProducts()}
      />
      <VariantImportModal
        open={variantImportOpen}
        onClose={() => setVariantImportOpen(false)}
        onCommitted={() => void loadProducts()}
      />
    </AdminShell>
  );
}
