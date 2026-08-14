"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { formatPaise, type ImportSummary } from "./types";

type Phase = "upload" | "preview" | "done";

interface VariantPreviewRow {
  line: number;
  sku: string;
  product?: string;
  label?: string;
  pack?: string;
  pricePaise?: number;
  stock?: number;
  valid: boolean;
  note?: string;
}

interface VariantPreview {
  total: number;
  validCount: number;
  invalidCount: number;
  rows: VariantPreviewRow[];
}

const ENDPOINT = "/api/admin/inventory/variants/import";

/** CSV import for variants — preview then commit, matched by SKU. */
export function VariantImportModal({
  open,
  onClose,
  onCommitted,
}: {
  open: boolean;
  onClose: () => void;
  onCommitted: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<VariantPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setPhase("upload");
    setCsv("");
    setFilename("");
    setPreview(null);
    setSummary(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setFilename(file.name);
    setBusy(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: text, commit: false }),
      });
      const data = (await res.json()) as { ok: boolean } & VariantPreview;
      if (!res.ok || !data.ok) throw new Error("preview-failed");
      setPreview(data);
      setPhase("preview");
    } catch {
      toast.error("Could not read that file", { description: "Check the CSV format and try again." });
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, commit: true }),
      });
      const data = (await res.json()) as { ok: boolean } & ImportSummary;
      if (!res.ok || !data.ok) throw new Error("commit-failed");
      setSummary(data);
      setPhase("done");
      toast.success("Import complete", {
        description: `${data.created} created · ${data.updated} updated.`,
      });
      onCommitted();
    } catch {
      toast.error("Import failed", { description: "No rows were saved." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import variants from CSV"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">Import variants</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-ng-ink-muted hover:text-ng-ink transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </header>

        <div className="px-6 py-5">
          {phase === "upload" ? (
            <div>
              <p className="text-[13px] text-ng-ink-muted mb-4">
                Upload a CSV with columns:{" "}
                <span className="font-mono text-[12px] text-ng-forest-deep">sku, product, label, pack, price, stock</span>.
                Existing variants are matched by SKU and updated; unknown SKUs are created against the
                <span className="font-mono"> product</span> (slug or name).
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-ng-line-soft hover:border-ng-forest bg-ng-cream/40 py-10 flex flex-col items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Icon name="upload-bold" size={26} className="text-ng-forest" />
                <span className="text-[13px] font-semibold text-ng-ink">
                  {busy ? "Reading…" : "Choose a CSV file"}
                </span>
                {filename ? <span className="text-[12px] text-ng-ink-muted">{filename}</span> : null}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}

          {phase === "preview" && preview ? (
            <div>
              <div className="flex items-center gap-3 mb-4 text-[13px]">
                <span className="font-semibold text-ng-ink">{preview.validCount} ready</span>
                {preview.invalidCount > 0 ? (
                  <span className="text-ng-terracotta font-semibold">{preview.invalidCount} skipped</span>
                ) : null}
                <span className="text-ng-ink-muted">· {preview.total} rows total</span>
              </div>
              <div className="rounded-xl border border-ng-line-soft overflow-hidden max-h-72 overflow-y-auto">
                <div className="grid grid-cols-[1.6fr_1.4fr_1fr_0.8fr_0.8fr] gap-2 px-4 py-2.5 bg-ng-cream text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold sticky top-0">
                  <span>SKU</span>
                  <span>Product</span>
                  <span>Label</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Stock</span>
                </div>
                <ul>
                  {preview.rows.map((r) => (
                    <li
                      key={r.line}
                      className={`grid grid-cols-[1.6fr_1.4fr_1fr_0.8fr_0.8fr] gap-2 px-4 py-2 items-center text-[12.5px] border-b border-ng-line-soft last:border-0 ${
                        r.valid ? "" : "bg-ng-terracotta/5"
                      }`}
                    >
                      <span className="font-mono text-[11.5px] truncate font-semibold text-ng-ink">
                        {r.sku || <span className="text-ng-terracotta italic">{r.note}</span>}
                      </span>
                      <span className="text-ng-ink-muted truncate">{r.product ?? "—"}</span>
                      <span className="text-ng-ink-muted truncate">
                        {r.label ?? "—"}
                        {r.pack ? ` · ${r.pack}` : ""}
                      </span>
                      <span className="font-mono tabular-nums text-ng-ink text-right">{formatPaise(r.pricePaise ?? 0)}</span>
                      <span className="font-mono tabular-nums text-ng-ink text-right">{r.stock ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {phase === "done" && summary ? (
            <div className="py-4 text-center">
              <span className="inline-flex size-12 rounded-full bg-ng-success/15 items-center justify-center mb-3">
                <Icon name="check-circle-bold" size={26} className="text-ng-success" />
              </span>
              <p className="text-[15px] font-semibold text-ng-ink">Import complete</p>
              <p className="text-[13px] text-ng-ink-muted mt-1">
                {summary.created} created · {summary.updated} updated
                {summary.skipped > 0 ? ` · ${summary.skipped} skipped` : ""}.
              </p>
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-ng-line-soft">
          {phase === "preview" ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || !preview || preview.validCount === 0}
                onClick={() => void commit()}
                className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UiIcon name="import" size={15} />
                {busy ? "Importing…" : `Import ${preview?.validCount ?? 0}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
            >
              {phase === "done" ? "Done" : "Cancel"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
