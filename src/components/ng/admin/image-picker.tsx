"use client";

/**
 * Admin image picker — lets an operator either upload a NEW image (via the
 * existing `/api/admin/inventory/upload` endpoint) OR reuse an ALREADY-UPLOADED
 * one, browsed from the shared `product-images` bucket through `/api/admin/media`.
 *
 * Exports:
 *   • MediaBrowser — the modal gallery (upload + pick existing).
 *   • ImageField   — a single-image form field (preview + choose/remove + URL).
 *   • GalleryField — a multi-image field (thumbnail strip + add/remove).
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

const FIELD =
  "w-full rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-1.5";

type MediaImage = { name: string; url: string };

/** Upload one file to the shared bucket; returns the public URL or throws. */
async function uploadImage(file: File): Promise<string> {
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) throw new Error("Image must be 5 MB or smaller.");
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/inventory/upload", { method: "POST", body });
  const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "upload-failed");
  return data.url;
}

export function MediaBrowser({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/media");
      const data = (await res.json()) as { ok: boolean; images: MediaImage[] };
      setImages(data.ok ? data.images : []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      void load();
    }
  }, [open, load]);

  if (!open) return null;

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onPick(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ng-forest-deep/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose image"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[85vh] flex flex-col">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <div>
            <h2 className="font-display text-[19px] text-ng-forest-deep">Choose an image</h2>
            <p className="text-[12px] text-ng-ink-muted mt-0.5">
              Reuse an already-uploaded image, or upload a new one.
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

        <div className="px-6 py-4 border-b border-ng-line-soft">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            className={`grid place-items-center rounded-xl border-2 border-dashed py-5 text-center transition-colors cursor-pointer ${
              dragOver ? "border-ng-forest bg-ng-forest/5" : "border-ng-line-soft hover:border-ng-forest"
            }`}
          >
            <div className="flex flex-col items-center gap-1 text-ng-ink-muted">
              <Icon name={uploading ? "refresh-bold" : "upload-bold"} size={22} className={uploading ? "animate-spin" : ""} />
              <span className="text-[12px] font-medium">
                {uploading ? "Uploading…" : "Upload a new image — drop or click · JPG/PNG/WebP ≤ 5 MB"}
              </span>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />
          {error && <p className="mt-2 text-[11px] font-semibold text-ng-danger">{error}</p>}
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-3">
            Already uploaded
          </div>
          {loading ? (
            <div className="grid place-items-center py-10 text-ng-ink-muted">
              <Icon name="refresh-bold" size={20} className="animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ng-ink-muted">
              No uploaded images yet. Upload one above to reuse it later.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => {
                    onPick(img.url);
                    onClose();
                  }}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-ng-line-soft hover:border-ng-forest transition-colors cursor-pointer"
                  title={img.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-ng-forest-deep/0 group-hover:bg-ng-forest-deep/20 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [browse, setBrowse] = useState(false);
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setBrowse(true)}
          aria-label={`Choose ${label}`}
          className="relative grid place-items-center h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-ng-line-soft bg-ng-paper hover:border-ng-forest transition-colors cursor-pointer"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-ng-ink-muted">
              <Icon name="gallery-add-bold" size={22} />
              <span className="text-[10px] font-medium">Pick / upload</span>
            </div>
          )}
        </button>
        <div className="flex-1 grid gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBrowse(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-3 py-1.5 text-[12px] hover:bg-ng-paper transition-colors cursor-pointer"
            >
              <Icon name="gallery-add-bold" size={14} />
              Choose image
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink-muted font-medium px-3 py-1.5 text-[12px] hover:text-ng-ink transition-colors cursor-pointer"
              >
                <Icon name="trash-bin-trash-bold" size={14} />
                Remove
              </button>
            )}
          </div>
          <input
            className={FIELD}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an image URL"
            aria-label={`${label} URL`}
          />
          {hint && <p className="text-[10.5px] font-medium text-ng-ink-muted">{hint}</p>}
        </div>
      </div>
      <MediaBrowser open={browse} onClose={() => setBrowse(false)} onPick={onChange} />
    </div>
  );
}

export function GalleryField({
  label,
  values,
  onChange,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const [browse, setBrowse] = useState(false);
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex flex-wrap gap-3">
        {values.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative h-20 w-20 overflow-hidden rounded-xl border border-ng-line-soft group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove image"
              className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-ng-forest-deep/70 text-ng-cream opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Icon name="close-circle-bold" size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setBrowse(true)}
          aria-label="Add gallery image"
          className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-ng-line-soft text-ng-ink-muted hover:border-ng-forest transition-colors cursor-pointer"
        >
          <Icon name="gallery-add-bold" size={22} />
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[10.5px] font-medium text-ng-ink-muted">{hint}</p>}
      <MediaBrowser open={browse} onClose={() => setBrowse(false)} onPick={(url) => onChange([...values, url])} />
    </div>
  );
}
