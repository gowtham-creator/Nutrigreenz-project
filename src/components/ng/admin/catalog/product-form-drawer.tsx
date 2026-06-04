"use client";

/**
 * ProductFormDrawer — accessible slide-over for creating / editing a catalog
 * product. Demo persistence only: `onSave` hands a fully-formed `AdminProduct`
 * back to the page, which updates local React state. Real DB save = Milestone 2.
 *
 * Accessibility:
 *   - role="dialog" + aria-modal, labelled by the heading.
 *   - Escape closes; backdrop click closes.
 *   - Focus moves to the first field on open and is restored on close.
 *   - All inputs have associated <label htmlFor> and are keyboard-reachable.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ng/admin/admin-shell";
import { cn } from "@/lib/utils";
import {
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  STATUS_TONE,
  type AdminProduct,
  type ProductStatus,
} from "./types";

/** Empty draft used when adding a brand-new product. */
function emptyDraft(): AdminProduct {
  return {
    id: "",
    title: "",
    sku: "",
    category: "Oils",
    price: 0,
    mrp: 0,
    stock: 0,
    status: "Draft",
    lot: "",
    description: "",
    rating: 0,
    image: "/images/placeholder.svg",
  };
}

interface FieldErrors {
  title?: string;
  sku?: string;
  price?: string;
}

export function ProductFormDrawer({
  open,
  product,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Row being edited, or `null` when creating a new product. */
  product: AdminProduct | null;
  onClose: () => void;
  onSave: (next: AdminProduct, mode: "create" | "edit") => void;
}) {
  const headingId = useId();
  const [draft, setDraft] = useState<AdminProduct>(emptyDraft());
  const [errors, setErrors] = useState<FieldErrors>({});
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const mode: "create" | "edit" = product ? "edit" : "create";

  // Seed the draft whenever the drawer opens (or the target row changes).
  useEffect(() => {
    if (!open) return;
    setDraft(product ? { ...product } : emptyDraft());
    setErrors({});
    // Remember what was focused so we can restore it on close.
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    // Focus the first field after paint.
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, product]);

  // Escape-to-close + restore focus on unmount of the open state.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the drawer is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function set<K extends keyof AdminProduct>(key: K, value: AdminProduct[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function validate(d: AdminProduct): FieldErrors {
    const e: FieldErrors = {};
    if (!d.title.trim()) e.title = "Product name is required.";
    if (!d.sku.trim()) e.sku = "SKU is required.";
    if (d.price < 0) e.price = "Price can't be negative.";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const id = draft.id || `new-${Date.now()}`;
    onSave({ ...draft, id }, mode);
  }

  const discount = draft.mrp > draft.price && draft.mrp > 0 ? Math.round(((draft.mrp - draft.price) / draft.mrp) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close form"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-[1px] cursor-pointer"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative h-full w-full max-w-[480px] bg-ng-cream border-l border-ng-line-soft shadow-[-12px_0_40px_rgba(31,77,46,0.16)] flex flex-col animate-[ngDrawerIn_180ms_ease-out]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ng-line-soft bg-ng-paper">
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-[22px] text-ng-forest-deep leading-tight">
              {mode === "edit" ? "Edit product" : "New product"}
            </h2>
            <p className="text-[12px] text-ng-ink-soft mt-1">
              {mode === "edit" ? draft.sku || "—" : "Add a SKU to the catalog"}
              <span className="ml-2 text-ng-clay">· demo save (M2: persist to DB)</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 size-9 rounded-full flex items-center justify-center text-ng-ink-soft hover:bg-ng-line-soft hover:text-ng-forest-deep transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <Field label="Product name" htmlFor="pf-name" error={errors.title} required>
            <input
              ref={firstFieldRef}
              id="pf-name"
              type="text"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Cold-Pressed Groundnut Oil — 1L"
              aria-invalid={errors.title ? true : undefined}
              className={inputCls(Boolean(errors.title))}
            />
          </Field>

          {/* SKU + Category */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" htmlFor="pf-sku" error={errors.sku} required>
              <input
                id="pf-sku"
                type="text"
                value={draft.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="OIL-GN-1L"
                aria-invalid={errors.sku ? true : undefined}
                className={cn(inputCls(Boolean(errors.sku)), "font-mono")}
              />
            </Field>
            <Field label="Category" htmlFor="pf-category">
              <select
                id="pf-category"
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
                className={selectCls}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Price + MRP */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (₹)" htmlFor="pf-price" error={errors.price}>
              <input
                id="pf-price"
                type="number"
                min={0}
                inputMode="numeric"
                value={Number.isFinite(draft.price) ? draft.price : 0}
                onChange={(e) => set("price", Number(e.target.value))}
                className={cn(inputCls(Boolean(errors.price)), "font-mono tabular-nums")}
              />
            </Field>
            <Field
              label="MRP (₹)"
              htmlFor="pf-mrp"
              hint={discount > 0 ? `${discount}% off` : undefined}
            >
              <input
                id="pf-mrp"
                type="number"
                min={0}
                inputMode="numeric"
                value={Number.isFinite(draft.mrp) ? draft.mrp : 0}
                onChange={(e) => set("mrp", Number(e.target.value))}
                className={cn(inputCls(false), "font-mono tabular-nums")}
              />
            </Field>
          </div>

          {/* Stock + Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Stock (units)" htmlFor="pf-stock">
              <input
                id="pf-stock"
                type="number"
                min={0}
                inputMode="numeric"
                value={Number.isFinite(draft.stock) ? draft.stock : 0}
                onChange={(e) => set("stock", Number(e.target.value))}
                className={cn(inputCls(false), "font-mono tabular-nums")}
              />
            </Field>
            <Field label="Status" htmlFor="pf-status">
              <select
                id="pf-status"
                value={draft.status}
                onChange={(e) => set("status", e.target.value as ProductStatus)}
                className={selectCls}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Lot code */}
          <Field label="Lot code" htmlFor="pf-lot" hint="active batch">
            <input
              id="pf-lot"
              type="text"
              value={draft.lot}
              onChange={(e) => set("lot", e.target.value)}
              placeholder="ANT-24-051"
              className={cn(inputCls(false), "font-mono")}
            />
          </Field>

          {/* Short description */}
          <Field label="Short description" htmlFor="pf-desc">
            <textarea
              id="pf-desc"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Internal note / unit blurb shown on the PDP."
              className={cn(inputCls(false), "resize-y min-h-[72px]")}
            />
          </Field>

          {/* Live status preview */}
          <div className="flex items-center gap-2 rounded-xl bg-ng-paper border border-ng-line-soft px-4 py-3">
            <span className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Preview</span>
            <Pill tone={STATUS_TONE[draft.status]}>{draft.status}</Pill>
            <span className="ml-auto font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep">
              ₹{(Number.isFinite(draft.price) ? draft.price : 0).toLocaleString("en-IN")}
            </span>
          </div>
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ng-line-soft bg-ng-paper">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-cream transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-5 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="diskette-bold" size={15} />
            {mode === "edit" ? "Save changes" : "Add product"}
          </button>
        </div>
      </div>

      {/* Local keyframes (scoped via styled-jsx) */}
      <style jsx>{`
        @keyframes ngDrawerIn {
          from {
            transform: translateX(24px);
            opacity: 0.4;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/* ---- small field primitives -------------------------------------- */

function inputCls(hasError: boolean): string {
  return cn(
    "w-full rounded-xl bg-ng-paper border px-3.5 py-2.5 text-[13.5px] text-ng-ink outline-none transition-colors placeholder:text-ng-ink-soft/60",
    hasError ? "border-ng-terracotta focus:border-ng-terracotta" : "border-ng-line-soft focus:border-ng-forest",
  );
}

const selectCls = cn(
  "w-full rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-[13.5px] text-ng-ink outline-none transition-colors focus:border-ng-forest cursor-pointer",
);

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11.5px] uppercase tracking-wider font-semibold text-ng-ink-muted">
          {label}
          {required ? <span className="text-ng-terracotta ml-0.5">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] text-ng-clay font-medium normal-case tracking-normal">{hint}</span> : null}
      </label>
      {children}
      {error ? <p className="text-[11.5px] text-ng-terracotta mt-1.5">{error}</p> : null}
    </div>
  );
}
