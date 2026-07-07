"use client";

/**
 * CsvImportDialog — accessible modal for importing products from a CSV file.
 *
 * Flow: pick a file → parse with `parseProductCsv` → show a small preview
 * (first rows) + valid/skipped counts + any row errors → confirm to append the
 * valid rows to the local product list. Malformed rows are reported, never
 * thrown. Demo persistence only (M2 = server-side import).
 *
 * Accessibility: role="dialog" + aria-modal, Escape closes, focus moves to the
 * file input on open and is restored on close, all controls keyboard-reachable.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ng/admin/admin-shell";
import { parseProductCsv, type CsvParseResult } from "./csv";
import type { AdminProduct } from "./types";

export function CsvImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: AdminProduct[]) => void;
}) {
  const headingId = useId();
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFileName("");
    setResult(null);
    setParsing(false);
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = setTimeout(() => fileRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

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

  if (!open) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setResult(parseProductCsv(text));
      setParsing(false);
    };
    reader.onerror = () => {
      setResult({ rows: [], skipped: 0, total: 0, errors: ["Couldn't read the file."] });
      setParsing(false);
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!result || result.rows.length === 0) return;
    onImport(result.rows);
  }

  const preview = result?.rows.slice(0, 5) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close import dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-[1px] cursor-pointer"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-ng-cream border border-ng-line-soft shadow-[var(--shadow-ng-modal)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ng-line-soft bg-ng-paper">
          <div>
            <h2 id={headingId} className="font-display text-[21px] text-ng-forest-deep leading-tight">
              Import products
            </h2>
            <p className="text-[12px] font-medium text-ng-ink-soft mt-1">
              CSV columns: <span className="font-mono font-medium text-[11.5px] text-ng-ink-muted">name, sku, category, price, mrp, stock, status</span>
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* File picker */}
          <label
            htmlFor="csv-file"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ng-line px-6 py-8 text-center cursor-pointer hover:border-ng-forest hover:bg-ng-paper/60 transition-colors"
          >
            <span className="size-11 rounded-full bg-ng-forest/10 flex items-center justify-center">
              <Icon name="upload-bold" size={20} className="text-ng-forest" />
            </span>
            <span className="text-[13.5px] font-semibold text-ng-forest-deep">
              {fileName || "Choose a CSV file"}
            </span>
            <span className="text-[11.5px] font-medium text-ng-ink-soft">Click to browse · .csv</span>
            <input
              ref={fileRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="sr-only"
            />
          </label>

          {parsing ? <p className="text-[12.5px] font-medium text-ng-ink-soft text-center">Parsing…</p> : null}

          {/* Result summary */}
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Pill tone={result.rows.length > 0 ? "success" : "warn"}>
                  {result.rows.length} valid
                </Pill>
                {result.skipped > 0 ? <Pill tone="danger">{result.skipped} skipped</Pill> : null}
                <span className="text-[12px] font-medium text-ng-ink-soft">of {result.total} rows</span>
              </div>

              {/* Preview table */}
              {preview.length > 0 ? (
                <div className="rounded-xl border border-ng-line-soft overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_0.8fr_0.6fr] gap-2 px-3.5 py-2 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
                    <span>Name</span>
                    <span>SKU</span>
                    <span>Price</span>
                    <span>Stock</span>
                  </div>
                  <ul>
                    {preview.map((r) => (
                      <li
                        key={r.id}
                        className="grid grid-cols-[2fr_1fr_0.8fr_0.6fr] gap-2 px-3.5 py-2 items-center text-[12px] font-medium border-b border-ng-line-soft last:border-0 bg-ng-paper"
                      >
                        <span className="truncate font-semibold text-ng-ink">{r.title}</span>
                        <span className="font-mono font-medium text-[11px] text-ng-ink-muted truncate">{r.sku}</span>
                        <span className="font-mono tabular-nums font-semibold text-ng-ink">₹{r.price.toLocaleString("en-IN")}</span>
                        <span className="font-mono tabular-nums font-semibold text-ng-ink">{r.stock}</span>
                      </li>
                    ))}
                  </ul>
                  {result.rows.length > preview.length ? (
                    <div className="px-3.5 py-1.5 text-[11.5px] font-medium text-ng-ink-soft bg-ng-cream/60 border-t border-ng-line-soft">
                      + {result.rows.length - preview.length} more row{result.rows.length - preview.length === 1 ? "" : "s"}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Errors */}
              {result.errors.length > 0 ? (
                <details className="rounded-xl bg-ng-terracotta/8 border border-ng-terracotta/25 px-3.5 py-2.5">
                  <summary className="text-[12px] font-semibold text-ng-terracotta cursor-pointer">
                    {result.errors.length} issue{result.errors.length === 1 ? "" : "s"} — review
                  </summary>
                  <ul className="mt-2 space-y-1 text-[11.5px] font-medium text-ng-ink-muted max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>· {err}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
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
            onClick={confirmImport}
            disabled={!result || result.rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-5 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="import-bold" size={15} />
            Import {result && result.rows.length > 0 ? `${result.rows.length}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
