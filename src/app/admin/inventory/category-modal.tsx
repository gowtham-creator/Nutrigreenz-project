"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import type { Category } from "./types";

const FIELD =
  "rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";

/** A small curated set of Solar icons for category pills (admins can still upload
 *  a real image, which the storefront prefers over the icon). */
const ICON_PRESETS = [
  "bottle-bold",
  "cup-hot-bold",
  "wineglass-bold",
  "donut-bold",
  "bag-4-bold",
  "box-minimalistic-bold",
  "leaf-bold",
  "chef-hat-bold",
];

type Draft = { name: string; icon: string | null; imageUrl: string | null };

export function CategoryModal({
  open,
  categories,
  busy,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean;
  categories: readonly Category[];
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: Draft) => void;
  onRename: (id: string, draft: Draft) => void;
  onDelete: (id: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customIcons, setCustomIcons] = useState<string[]>([]);
  const [iconInput, setIconInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEditId(null);
    setName("");
    setIcon(null);
    setImageUrl(null);
    setIconInput("");
  }

  /** Add any Solar icon by name to the pickable row (and select it). */
  function addCustomIcon() {
    const n = iconInput.trim();
    if (!n) return;
    setCustomIcons((c) => (c.includes(n) ? c : [...c, n]));
    setIcon(n);
    setIconInput("");
  }

  // Reset the form each time the modal (re)opens.
  useEffect(() => {
    if (open) reset();
  }, [open]);

  if (!open) return null;

  function startEdit(c: Category) {
    setEditId(c.id);
    setName(c.name);
    setIcon(c.icon);
    setImageUrl(c.imageUrl);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const draft: Draft = { name: trimmed, icon, imageUrl };
    if (editId) onRename(editId, draft);
    else onCreate(draft);
    reset();
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/inventory/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error();
      setImageUrl(data.url as string);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Manage categories"
    >
      <div className="w-full max-w-md rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">Categories</h2>
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
          {/* Create / edit form */}
          <div className="mb-5 rounded-xl border border-ng-line-soft bg-ng-cream/40 p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
              {editId ? "Edit category" : "New category"}
            </div>
            <input
              className={`${FIELD} w-full`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />

            {/* Image (preferred on the storefront) */}
            <div className="mt-3 flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-ng-line-soft bg-ng-paper">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="size-full object-cover" />
                ) : icon ? (
                  <Icon name={icon} size={22} className="text-ng-forest" />
                ) : (
                  <Icon name="gallery-bold" size={20} className="text-ng-ink-soft" />
                )}
              </div>
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-[12px] font-semibold text-ng-forest hover:text-ng-leaf cursor-pointer disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
                </button>
                {imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="text-[11px] font-medium text-ng-terracotta hover:opacity-80 cursor-pointer"
                  >
                    Remove image
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
            </div>

            {/* Icon picker — the fallback when no image is set. Presets plus any
                custom Solar icon the admin adds by name. */}
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-medium text-ng-ink-soft">Or pick an icon</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...ICON_PRESETS, ...customIcons, ...(icon ? [icon] : [])])).map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setIcon(icon === n ? null : n)}
                      aria-pressed={icon === n}
                      className={
                        "grid size-9 place-items-center rounded-lg border transition-colors cursor-pointer " +
                        (icon === n
                          ? "border-ng-forest bg-ng-forest text-ng-paper"
                          : "border-ng-line-soft bg-ng-paper text-ng-ink-muted hover:border-ng-leaf")
                      }
                    >
                      <Icon name={n} size={16} />
                    </button>
                  ),
                )}
              </div>

              {/* Add any icon by name (Iconify Solar set) with a live preview. */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  className={`${FIELD} flex-1`}
                  value={iconInput}
                  onChange={(e) => setIconInput(e.target.value.trim())}
                  placeholder="Add icon by name, e.g. tea-cup-bold"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomIcon();
                    }
                  }}
                />
                {iconInput ? (
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-ng-line-soft bg-ng-paper text-ng-forest">
                    <Icon name={iconInput} size={16} />
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={addCustomIcon}
                  disabled={!iconInput}
                  className="shrink-0 rounded-full bg-ng-forest-deep px-3 py-1.5 text-[12px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add icon
                </button>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-ng-ink-soft">
                Any name from the Solar icon set (see solar-icons on iconify.design), e.g.{" "}
                <code className="text-ng-forest">bottle-bold</code>,{" "}
                <code className="text-ng-forest">honey-bold</code>.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {editId ? (
                <button
                  type="button"
                  onClick={reset}
                  className="text-[12px] font-semibold text-ng-ink-muted hover:text-ng-ink cursor-pointer"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || uploading || !name.trim()}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name={editId ? "save" : "add-circle-bold"} size={15} />
                {editId ? "Save" : "Add"}
              </button>
            </div>
          </div>

          {/* Existing categories */}
          {categories.length === 0 ? (
            <p className="text-[13px] font-medium text-ng-ink-muted">No categories yet.</p>
          ) : (
            <ul className="divide-y divide-ng-line-soft">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-ng-line-soft bg-ng-paper">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Icon name={c.icon || "widget-5-bold"} size={16} className="text-ng-forest" />
                    )}
                  </div>
                  <span className="flex-1 truncate text-[13px] font-semibold text-ng-ink">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label={`Edit ${c.name}`}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-forest hover:text-ng-leaf transition-colors cursor-pointer"
                  >
                    <Icon name="pen-2-bold" size={13} />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete ${c.name}`}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-ng-terracotta hover:text-ng-terracotta/80 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Icon name="trash-bin-trash-bold" size={13} />
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
