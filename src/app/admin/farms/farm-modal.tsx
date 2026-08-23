"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ImageField, GalleryField } from "@/components/ng/admin/image-picker";

/** A farm as returned by /api/admin/farms. */
export interface Farm {
  id: string;
  name: string;
  region: string;
  hectares: number | null;
  practices: string[];
  partneredSince: string | null;
  farmerName: string | null;
  story: string | null;
  image: string | null;
  gallery: string[];
  sort: number;
}

export interface FarmDraft {
  name: string;
  region: string;
  hectares: string;
  farmerName: string;
  partneredSince: string;
  practices: string;
  story: string;
  image: string;
  gallery: string[];
}

const FIELD =
  "w-full rounded-xl bg-ng-paper border border-ng-line-soft px-3.5 py-2.5 text-[13px] text-ng-ink outline-none focus:border-ng-forest transition-colors";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-1.5";

function draftFrom(f: Farm | null): FarmDraft {
  return {
    name: f?.name ?? "",
    region: f?.region ?? "",
    hectares: f?.hectares != null ? String(f.hectares) : "",
    farmerName: f?.farmerName ?? "",
    partneredSince: f?.partneredSince ? f.partneredSince.slice(0, 10) : "",
    practices: f?.practices?.join(", ") ?? "",
    story: f?.story ?? "",
    image: f?.image ?? "",
    gallery: f?.gallery ?? [],
  };
}

export function FarmModal({
  open,
  farm,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  farm: Farm | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: FarmDraft) => void;
}) {
  const [draft, setDraft] = useState<FarmDraft>(() => draftFrom(farm));

  if (!open) return null;

  const set = <K extends keyof FarmDraft>(key: K, value: FarmDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.name.trim().length > 0 && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ng-forest-deep/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={farm ? "Edit farm" : "Add farm"}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-ng-paper border border-ng-line-soft shadow-[var(--shadow-ng-modal)] max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-ng-line-soft">
          <h2 className="font-display text-[19px] text-ng-forest-deep">
            {farm ? "Edit farm" : "Add farm"}
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
            <label className={LABEL} htmlFor="nf-name">Farm name</label>
            <input
              id="nf-name"
              className={FIELD}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Mallika & Subbaiah Farm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="nf-region">Region</label>
              <input
                id="nf-region"
                className={FIELD}
                value={draft.region}
                onChange={(e) => set("region", e.target.value)}
                placeholder="Anantapur, Andhra Pradesh"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="nf-farmer">Farmer</label>
              <input
                id="nf-farmer"
                className={FIELD}
                value={draft.farmerName}
                onChange={(e) => set("farmerName", e.target.value)}
                placeholder="K. Subbaiah"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="nf-hectares">Hectares</label>
              <input
                id="nf-hectares"
                type="number"
                min={0}
                step="0.1"
                className={FIELD}
                value={draft.hectares}
                onChange={(e) => set("hectares", e.target.value)}
                placeholder="14"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="nf-since">Partnered since</label>
              <input
                id="nf-since"
                type="date"
                className={FIELD}
                value={draft.partneredSince}
                onChange={(e) => set("partneredSince", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="nf-practices">Practices / crops</label>
            <input
              id="nf-practices"
              className={FIELD}
              value={draft.practices}
              onChange={(e) => set("practices", e.target.value)}
              placeholder="organic, rainwater harvesting, intercropping"
            />
            <p className="mt-1 text-[10.5px] font-medium text-ng-ink-muted">Comma-separated tags shown as pills.</p>
          </div>

          <div>
            <label className={LABEL} htmlFor="nf-story">Story</label>
            <textarea
              id="nf-story"
              rows={4}
              className={`${FIELD} resize-none`}
              value={draft.story}
              onChange={(e) => set("story", e.target.value)}
              placeholder="Three generations of dryland farming…"
            />
          </div>

          <ImageField
            label="Hero image"
            value={draft.image}
            onChange={(v) => set("image", v)}
            hint="The full-width banner at the top of the farm page and the card cover."
          />

          <GalleryField
            label="Gallery"
            values={draft.gallery}
            onChange={(v) => set("gallery", v)}
            hint="Optional. Shown in the two-up grid on the farm page."
          />
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
            {saving ? "Saving…" : farm ? "Save changes" : "Create farm"}
          </button>
        </footer>
      </div>
    </div>
  );
}
