"use client";

/**
 * StockAdjustDialog — accessible modal to adjust a SKU's stock level and toggle
 * its reorder flag from the Inventory screen. Demo persistence only: `onSave`
 * returns the new stock + reorder values and the page updates local state.
 * Real warehouse write = Milestone 2.
 *
 * Accessibility: role="dialog" + aria-modal, Escape closes, focus moves to the
 * stock input on open and restores on close, labelled controls + quick steppers.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ng/admin/admin-shell";
import { cn } from "@/lib/utils";

export interface StockTarget {
  sku: string;
  product: string;
  stock: number;
  threshold: number;
  lot: string;
  reorder: boolean;
}

function stateOf(stock: number, threshold: number) {
  if (stock <= 0) return { tone: "neutral" as const, label: "Out" };
  if (stock <= threshold) return { tone: "danger" as const, label: "Low" };
  return { tone: "success" as const, label: "OK" };
}

export function StockAdjustDialog({
  open,
  target,
  onClose,
  onSave,
}: {
  open: boolean;
  target: StockTarget | null;
  onClose: () => void;
  onSave: (sku: string, nextStock: number, reorder: boolean) => void;
}) {
  const headingId = useId();
  const [stock, setStock] = useState(0);
  const [reorder, setReorder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !target) return;
    setStock(target.stock);
    setReorder(target.reorder);
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, [open, target]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !target) return null;

  const safeStock = Number.isFinite(stock) ? Math.max(0, stock) : 0;
  const st = stateOf(safeStock, target.threshold);

  function step(delta: number) {
    setStock((s) => Math.max(0, (Number.isFinite(s) ? s : 0) + delta));
  }

  function handleSave() {
    onSave(target!.sku, safeStock, reorder);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close stock editor"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-[1px] cursor-pointer"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-[420px] rounded-2xl bg-ng-cream border border-ng-line-soft shadow-[0_24px_64px_rgba(31,77,46,0.22)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ng-line-soft bg-ng-paper">
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-[20px] text-ng-forest-deep leading-tight">
              Adjust stock
            </h2>
            <p className="text-[12px] text-ng-ink-soft mt-1 truncate">
              <span className="font-mono text-[11px] text-ng-forest-deep">{target.sku}</span> · {target.product}
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

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Stock stepper */}
          <div>
            <label htmlFor="sa-stock" className="block text-[11.5px] uppercase tracking-wider font-semibold text-ng-ink-muted mb-1.5">
              Stock on hand (units)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease stock by 10"
                onClick={() => step(-10)}
                className="size-10 shrink-0 rounded-xl border border-ng-line-soft bg-ng-paper text-ng-forest-deep hover:bg-ng-cream transition-colors cursor-pointer font-mono text-[13px]"
              >
                −10
              </button>
              <input
                ref={inputRef}
                id="sa-stock"
                type="number"
                min={0}
                inputMode="numeric"
                value={Number.isFinite(stock) ? stock : 0}
                onChange={(e) => setStock(Number(e.target.value))}
                className="flex-1 rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-center text-[18px] font-mono tabular-nums font-semibold text-ng-forest-deep outline-none focus:border-ng-forest"
              />
              <button
                type="button"
                aria-label="Increase stock by 10"
                onClick={() => step(10)}
                className="size-10 shrink-0 rounded-xl border border-ng-line-soft bg-ng-paper text-ng-forest-deep hover:bg-ng-cream transition-colors cursor-pointer font-mono text-[13px]"
              >
                +10
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11.5px]">
              <span className="text-ng-ink-soft">
                Reorder threshold <span className="font-mono tabular-nums">{target.threshold}</span> · lot{" "}
                <span className="font-mono">{target.lot || "—"}</span>
              </span>
              <Pill tone={st.tone}>{st.label}</Pill>
            </div>
          </div>

          {/* Reorder toggle */}
          <label
            htmlFor="sa-reorder"
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors",
              reorder ? "border-ng-terracotta/40 bg-ng-terracotta/8" : "border-ng-line-soft bg-ng-paper hover:bg-ng-cream",
            )}
          >
            <input
              id="sa-reorder"
              type="checkbox"
              checked={reorder}
              onChange={(e) => setReorder(e.target.checked)}
              className="size-4 accent-ng-terracotta cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ng-ink">Flag for reorder</span>
              <span className="block text-[11.5px] text-ng-ink-soft">Adds this SKU to the auto-PO draft queue.</span>
            </span>
            <Icon
              name={reorder ? "danger-triangle-bold" : "box-bold"}
              size={18}
              className={cn("ml-auto shrink-0", reorder ? "text-ng-terracotta" : "text-ng-ink-soft")}
            />
          </label>
        </div>

        {/* Footer */}
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
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-5 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="diskette-bold" size={15} />
            Save stock
          </button>
        </div>
      </div>
    </div>
  );
}
