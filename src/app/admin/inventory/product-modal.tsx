"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { STATUS_OPTIONS, type Category, type Product, type ProductStatus } from "./types";

export interface ProductDraft {
  name: string;
  sku: string;
  categoryId: string;
  priceRupees: string;
  stock: string;
  status: ProductStatus;
  description: string;
}

function draftFromProduct(p: Product | null): ProductDraft {
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    categoryId: p?.categoryId ?? "",
    priceRupees: p ? (p.pricePaise / 100).toFixed(2) : "",
    stock: p ? String(p.stock) : "0",
    status: p?.status ?? "active",
    description: p?.description ?? "",
  };
}

const FIELD =
  "w-full rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-1.5";

export function ProductModal({
  open,
  product,
  categories,
  saving,
  isSuper,
  onClose,
  onSave,
}: {
  open: boolean;
  product: Product | null;
  categories: readonly Category[];
  saving: boolean;
  isSuper: boolean;
  onClose: () => void;
  onSave: (draft: ProductDraft) => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => draftFromProduct(product));

  if (!open) return null;

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.name.trim().length > 0 && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product ? "Edit product" : "Add product"}
    >
      <div className="w-full max-w-lg rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[0_24px_64px_rgba(31,77,46,0.18)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">
            {product ? "Edit product" : "Add product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ng-ink-muted hover:text-ng-ink transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </header>

        <div className="px-6 py-5 grid gap-4">
          <div>
            <label className={LABEL} htmlFor="np-name">Name</label>
            <input
              id="np-name"
              className={FIELD}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Baby Spinach"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="np-sku">SKU</label>
              <input
                id="np-sku"
                className={FIELD}
                value={draft.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="NG-LG-SPN-200"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="np-category">Category</label>
              <select
                id="np-category"
                className={FIELD}
                value={draft.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL} htmlFor="np-price">Price (₹)</label>
              <input
                id="np-price"
                type="number"
                min={0}
                step="0.01"
                disabled={!isSuper}
                className={`${FIELD} disabled:cursor-not-allowed disabled:opacity-60`}
                value={draft.priceRupees}
                onChange={(e) => set("priceRupees", e.target.value)}
                placeholder="89.00"
              />
              {!isSuper && (
                <p className="mt-1 text-[10.5px] font-medium text-ng-ink-muted">Set by Super Admin</p>
              )}
            </div>
            <div>
              <label className={LABEL} htmlFor="np-stock">Stock</label>
              <input
                id="np-stock"
                type="number"
                min={0}
                className={FIELD}
                value={draft.stock}
                onChange={(e) => set("stock", e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="np-status">Status</label>
              <select
                id="np-status"
                className={FIELD}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ProductStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="np-desc">Description</label>
            <textarea
              id="np-desc"
              rows={3}
              className={`${FIELD} resize-none`}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short description for the storefront."
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-ng-line-soft">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(draft)}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="diskette-bold" size={15} />
            {saving ? "Saving…" : product ? "Save changes" : "Create product"}
          </button>
        </footer>
      </div>
    </div>
  );
}
