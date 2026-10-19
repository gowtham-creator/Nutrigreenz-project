"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { GalleryField } from "@/components/ng/admin/image-picker";
import { PdpImagesPreview } from "@/components/ng/admin/inventory/pdp-images-preview";
import { STATUS_OPTIONS, type Category, type Product, type ProductStatus } from "./types";

export interface ProductDraft {
  name: string;
  sku: string;
  categoryId: string;
  priceRupees: string;
  stock: string;
  status: ProductStatus;
  description: string;
  imageUrl: string;
  /** Extra photos shown on the PDP after the lead shot, in this order. */
  gallery: string[];
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
    imageUrl: p?.imageUrl ?? "",
    gallery: p?.gallery ?? [],
  };
}

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

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
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.name.trim().length > 0 && !saving && !uploading;

  async function uploadFile(file: File) {
    setImageError(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setImageError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setImageError("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/inventory/upload", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error || "upload-failed");
      }
      set("imageUrl", data.url);
    } catch {
      setImageError("Couldn't upload the image. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product ? "Edit product" : "Add product"}
    >
      <div className="w-full max-w-lg rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
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

          <div>
            <label className={LABEL}>Product image</label>
            <div className="flex items-start gap-3">
              {/* Thumbnail preview / drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                aria-label="Upload product image"
                className={`relative grid place-items-center h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  dragOver
                    ? "border-ng-forest bg-ng-forest/5"
                    : "border-ng-line-soft bg-ng-paper hover:border-ng-forest"
                }`}
              >
                {draft.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.imageUrl}
                    alt="Product preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-ng-ink-muted">
                    <Icon name="gallery-add-bold" size={22} />
                    <span className="text-[10px] font-medium">Drop / pick</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-ng-paper/80 text-ng-forest-deep">
                    <Icon name="refresh-bold" size={18} className="animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 grid gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-3 py-1.5 text-[12px] hover:bg-ng-paper transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="upload-bold" size={14} />
                    {uploading ? "Uploading…" : "Upload image"}
                  </button>
                  {draft.imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        set("imageUrl", "");
                        setImageError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink-muted font-medium px-3 py-1.5 text-[12px] hover:text-ng-ink transition-colors cursor-pointer"
                    >
                      <Icon name="trash-bin-trash-bold" size={14} />
                      Remove
                    </button>
                  )}
                </div>
                {/* Paste-a-URL fallback */}
                <input
                  className={FIELD}
                  value={draft.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="…or paste an image URL"
                  aria-label="Image URL"
                />
                <p className="text-[10.5px] font-medium text-ng-ink-muted">
                  JPG, PNG or WebP · up to 5 MB.
                </p>
                {imageError && (
                  <p className="text-[10.5px] font-semibold text-ng-danger">{imageError}</p>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
                e.target.value = "";
              }}
            />

            {/* More photos. The product page used to pad its gallery with a set
                shared across the whole category, so a shopper saw another
                product's bottle; it now shows only what is uploaded here. */}
            <div className="mt-5 border-t border-ng-line-soft pt-5">
              <GalleryField
                label="More photos"
                values={draft.gallery}
                onChange={(v) => setDraft((d) => ({ ...d, gallery: v }))}
                hint="Shown on the product page after the main image, in this order (for example the label, the texture, the product in use). If left empty, the page shows captioned placeholders."
              />

              {/* The field above is only one of the sources the product page
                  draws from, so it cannot show a duplicate or a generated
                  panel. This reads the composed gallery back and does. Only for
                  a saved product — an unsaved draft has no id to compose. */}
              {product?.id ? (
                <div className="mt-5">
                  <PdpImagesPreview
                    productId={product.id}
                    gallery={draft.gallery}
                    onReplaceLead={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
                    onReplaceGallery={(next) => setDraft((d) => ({ ...d, gallery: next }))}
                  />
                </div>
              ) : null}
            </div>
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
            <Icon name="save" size={15} />
            {saving ? "Saving…" : product ? "Save changes" : "Create product"}
          </button>
        </footer>
      </div>
    </div>
  );
}
