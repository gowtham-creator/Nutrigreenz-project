"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { PACK_OPTIONS, type Product, type Variant } from "./types";

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/** Validate + upload one image to the shared inventory upload endpoint. */
async function uploadImage(file: File): Promise<string | null> {
  if (!ACCEPT.split(",").includes(file.type)) {
    toast.error("Use a JPG, PNG or WebP image.");
    return null;
  }
  if (file.size > MAX_BYTES) {
    toast.error("Image must be 5 MB or smaller.");
    return null;
  }
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/inventory/upload", { method: "POST", body });
  const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !data.ok || !data.url) {
    toast.error("Upload failed. Please try again.");
    return null;
  }
  return data.url;
}

interface RowEdit {
  priceRupees: string;
  stock: string;
}

interface NewDraft {
  label: string;
  pack: string;
  sizeValue: string;
  sizeUnit: string;
  sku: string;
  priceRupees: string;
  stock: string;
  imageUrl: string;
}

const emptyDraft = (): NewDraft => ({
  label: "",
  pack: "",
  sizeValue: "",
  sizeUnit: "",
  sku: "",
  priceRupees: "",
  stock: "0",
  imageUrl: "",
});

const FIELD =
  "w-full rounded-lg bg-ng-paper border border-ng-line-soft px-2.5 py-1.5 text-[12.5px] text-ng-ink outline-none focus:border-ng-forest transition-colors";
const LABEL = "block text-[10.5px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-1";

/** A compact 40px per-variant image control: shows the thumb (or a picker
 *  placeholder), triggers a hidden file input, and offers a corner "remove"
 *  affordance once an image is set. Used inline in each existing-variant row. */
function RowImage({
  imageUrl,
  uploading,
  disabled,
  onPick,
  onClear,
}: {
  imageUrl: string | null;
  uploading: boolean;
  disabled: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        aria-label={imageUrl ? "Change variant image" : "Add variant image"}
        title={imageUrl ? "Change variant image" : "Add variant image"}
        className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-dashed border-ng-line-soft bg-ng-paper text-ng-ink-muted transition-colors hover:border-ng-forest disabled:opacity-50"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="gallery-add-bold" size={16} />
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-ng-paper/80 text-ng-forest-deep">
            <Icon name="refresh-bold" size={14} className="animate-spin" />
          </span>
        )}
      </button>
      {imageUrl && !uploading ? (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Remove variant image"
          title="Remove variant image"
          className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ng-terracotta text-white shadow-sm transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Icon name="close-circle-bold" size={12} />
        </button>
      ) : null}
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Manage one base product's size × pack variants: price, stock, active, add/delete. */
export function VariantModal({
  open,
  product,
  isSuper,
  onClose,
  onChanged,
}: {
  open: boolean;
  product: Product | null;
  isSuper: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<NewDraft>(emptyDraft);
  // Which existing variant row is mid-upload (spinner), and whether the "add"
  // draft's own image is uploading.
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [draftUploading, setDraftUploading] = useState(false);

  const load = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    try {
      const data = await api<{ variants: Variant[] }>(
        `/api/admin/inventory/variants?productId=${product.id}`,
        "GET",
      );
      setVariants(data.variants);
      setEdits(
        Object.fromEntries(
          data.variants.map((v) => [
            v.id,
            { priceRupees: (v.pricePaise / 100).toFixed(2), stock: String(v.stock) },
          ]),
        ),
      );
    } catch {
      toast.error("Could not load variants");
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft());
      void load();
    }
  }, [open, load]);

  if (!open || !product) return null;

  const setEdit = (id: string, key: keyof RowEdit, value: string) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [key]: value } }));

  const saveRow = async (v: Variant) => {
    const edit = edits[v.id];
    if (!edit) return;
    setBusy(true);
    try {
      const stock = Math.max(0, Math.round(Number(edit.stock) || 0));
      // Price is super-admin-only — a plain admin saves stock only (a price PATCH
      // would 403). Super-admins push the edited price alongside the stock.
      if (isSuper) {
        const pricePaise = Math.max(0, Math.round((Number(edit.priceRupees) || 0) * 100));
        await api(`/api/admin/inventory/variants/${v.id}`, "PATCH", { pricePaise });
      }
      await api(`/api/admin/inventory/variants/${v.id}/stock`, "PUT", { stock });
      toast.success("Variant saved", { description: v.sku ?? v.label });
      await load();
      onChanged();
    } catch {
      toast.error("Could not save variant");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (v: Variant) => {
    setBusy(true);
    try {
      await api(`/api/admin/inventory/variants/${v.id}`, "PATCH", { isActive: !v.isActive });
      await load();
      onChanged();
    } catch {
      toast.error("Could not update variant");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: Variant) => {
    setBusy(true);
    try {
      await api(`/api/admin/inventory/variants/${v.id}`, "DELETE", {});
      toast.success("Variant removed", { description: v.sku ?? v.label });
      await load();
      onChanged();
    } catch {
      toast.error("Could not remove variant");
    } finally {
      setBusy(false);
    }
  };

  // Upload (or clear) an existing variant's own image, then persist via PATCH.
  const setRowImage = async (v: Variant, file: File | null) => {
    setUploadingId(v.id);
    try {
      let url: string | null = null;
      if (file) {
        url = await uploadImage(file);
        if (!url) return; // uploadImage already toasted the reason
      }
      await api(`/api/admin/inventory/variants/${v.id}`, "PATCH", { imageUrl: url });
      toast.success(file ? "Variant image updated" : "Variant image removed", {
        description: v.sku ?? v.label,
      });
      await load();
      onChanged();
    } catch {
      toast.error("Could not update variant image");
    } finally {
      setUploadingId(null);
    }
  };

  // Upload an image for the not-yet-created draft variant (held in local state
  // until "Add" persists it).
  const pickDraftImage = async (file: File) => {
    setDraftUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) set("imageUrl", url);
    } finally {
      setDraftUploading(false);
    }
  };

  const addVariant = async () => {
    if (!draft.label.trim()) {
      toast.error("Enter a size label, e.g: 1L");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/inventory/variants", "POST", {
        productId: product.id,
        label: draft.label.trim(),
        pack: draft.pack || null,
        sizeValue: draft.sizeValue ? Number(draft.sizeValue) : null,
        sizeUnit: draft.sizeUnit.trim() || null,
        sku: draft.sku.trim() || null,
        pricePaise: Math.max(0, Math.round((Number(draft.priceRupees) || 0) * 100)),
        stock: Math.max(0, Math.round(Number(draft.stock) || 0)),
        sort: variants.length * 10,
        imageUrl: draft.imageUrl.trim() || null,
      });
      toast.success("Variant added", { description: draft.label.trim() });
      setDraft(emptyDraft());
      await load();
      onChanged();
    } catch (err) {
      toast.error("Could not add variant", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof NewDraft>(key: K, value: NewDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Variants for ${product.name}`}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft sticky top-0 bg-ng-paper z-10">
          <div>
            <h2 className="font-display text-[19px] text-ng-forest-deep">Variants</h2>
            <p className="text-[12.5px] text-ng-ink-muted mt-0.5">
              {product.name} · price &amp; stock live on each size × pack
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ng-ink-muted hover:text-ng-ink transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </header>

        <div className="px-6 py-5">
          {/* Header row */}
          <div className="grid grid-cols-[1.5fr_1.4fr_0.9fr_0.9fr_1.2fr] gap-3 px-1 pb-2 text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
            <span>Variant</span>
            <span>SKU</span>
            <span>Price (₹)</span>
            <span>Stock</span>
            <span></span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-[13px] font-medium text-ng-ink-muted">Loading…</div>
          ) : variants.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-medium text-ng-ink-muted">
              No variants yet. Add the first size below.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {variants.map((v) => {
                const edit = edits[v.id] ?? { priceRupees: "0", stock: "0" };
                return (
                  <li
                    key={v.id}
                    className={`grid grid-cols-[1.5fr_1.4fr_0.9fr_0.9fr_1.2fr] gap-3 items-center rounded-xl border border-ng-line-soft px-3 py-2.5 ${
                      v.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <RowImage
                        imageUrl={v.imageUrl}
                        uploading={uploadingId === v.id}
                        disabled={busy || uploadingId !== null}
                        onPick={(file) => void setRowImage(v, file)}
                        onClear={() => void setRowImage(v, null)}
                      />
                      <span className="min-w-0 truncate text-[13px] font-semibold text-ng-ink">
                        {v.label}
                        {v.pack ? (
                          <span className="ml-1 text-[12px] font-medium text-ng-ink-muted">· {v.pack}</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="font-mono text-[11.5px] text-ng-ink-muted truncate">{v.sku ?? "—"}</span>
                    <div>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!isSuper}
                        value={edit.priceRupees}
                        onChange={(e) => setEdit(v.id, "priceRupees", e.target.value)}
                        className={`${FIELD} disabled:cursor-not-allowed disabled:opacity-60`}
                      />
                      {!isSuper && (
                        <p className="mt-0.5 text-[9.5px] font-medium text-ng-ink-muted">Set by Super Admin</p>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={edit.stock}
                      onChange={(e) => setEdit(v.id, "stock", e.target.value)}
                      className={FIELD}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveRow(v)}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-forest hover:text-ng-leaf transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Icon name="diskette-bold" size={13} />
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(v)}
                        aria-label={v.isActive ? "Deactivate variant" : "Activate variant"}
                        title={v.isActive ? "Active, click to hide" : "Inactive, click to show"}
                        className="text-ng-ink-muted hover:text-ng-forest transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Icon name={v.isActive ? "eye-bold" : "eye-closed-bold"} size={15} />
                      </button>
                      {isSuper && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(v)}
                          aria-label="Delete variant"
                          className="text-ng-terracotta hover:text-ng-terracotta/80 transition-colors cursor-pointer disabled:opacity-50"
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

          {/* Add new variant */}
          <div className="mt-6 rounded-xl border border-dashed border-ng-line bg-ng-cream/40 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-3">
              Add a variant
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={LABEL} htmlFor="nv-label">Size label</label>
                <input id="nv-label" className={FIELD} value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="1L" />
              </div>
              <div>
                <label className={LABEL} htmlFor="nv-pack">Pack</label>
                <select id="nv-pack" className={FIELD} value={draft.pack} onChange={(e) => set("pack", e.target.value)}>
                  <option value="">None</option>
                  {PACK_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="nv-size">Size value</label>
                <input id="nv-size" type="number" min={0} step="0.01" className={FIELD} value={draft.sizeValue} onChange={(e) => set("sizeValue", e.target.value)} placeholder="1" />
              </div>
              <div>
                <label className={LABEL} htmlFor="nv-unit">Size unit</label>
                <input id="nv-unit" className={FIELD} value={draft.sizeUnit} onChange={(e) => set("sizeUnit", e.target.value)} placeholder="L" />
              </div>
              <div>
                <label className={LABEL} htmlFor="nv-sku">SKU</label>
                <input id="nv-sku" className={FIELD} value={draft.sku} onChange={(e) => set("sku", e.target.value)} placeholder="OIL-GROUNDNUT-1L-GLASS" />
              </div>
              <div>
                <label className={LABEL} htmlFor="nv-price">Price (₹)</label>
                <input id="nv-price" type="number" min={0} step="0.01" disabled={!isSuper} className={`${FIELD} disabled:cursor-not-allowed disabled:opacity-60`} value={draft.priceRupees} onChange={(e) => set("priceRupees", e.target.value)} placeholder="0.00" />
                {!isSuper && (
                  <p className="mt-1 text-[9.5px] font-medium text-ng-ink-muted">Set by Super Admin</p>
                )}
              </div>
              <div>
                <label className={LABEL} htmlFor="nv-stock">Stock</label>
                <input id="nv-stock" type="number" min={0} className={FIELD} value={draft.stock} onChange={(e) => set("stock", e.target.value)} />
              </div>
              <div>
                <span className={LABEL}>Image</span>
                <RowImage
                  imageUrl={draft.imageUrl || null}
                  uploading={draftUploading}
                  disabled={busy}
                  onPick={(file) => void pickDraftImage(file)}
                  onClear={() => set("imageUrl", "")}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={busy || draftUploading}
                  onClick={() => void addVariant()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Icon name="add-circle-bold" size={15} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-ng-line-soft">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
