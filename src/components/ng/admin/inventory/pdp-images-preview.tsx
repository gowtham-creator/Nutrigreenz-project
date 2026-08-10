"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * PdpImagesPreview — what the product page will actually show, in order.
 *
 * The gallery field above this edits ONE of the sources the PDP draws from. The
 * page itself composes the lead image, then the operator gallery, then panels
 * generated from a manifest in the codebase, then the size-matched nutrition
 * slide. So an operator could add a path that the manifest was already
 * supplying and double that slide on the live page with nothing in the admin to
 * show it — which is how the groundnut page ended up running about twenty
 * images with every panel repeated.
 *
 * This reads the composed list back from the server and labels each slide with
 * where it came from, so a duplicate is visible before it ships and the slides
 * that cannot be edited here are marked as such rather than appearing missing.
 */

type Source = "lead" | "operator" | "generated" | "nutrition";

interface Slide {
  src: string;
  label: string;
  source: Source;
  editable: boolean;
  duplicateOf?: Source;
}

interface Payload {
  ok: boolean;
  total: number;
  duplicates: number;
  nutritionSizes: string[];
  slides: Slide[];
}

const SOURCE_COPY: Record<Source, { tag: string; hint: string; className: string }> = {
  lead: { tag: "Lead", hint: "The main product image above", className: "bg-ng-forest text-ng-paper" },
  operator: { tag: "Gallery", hint: "From the gallery field above", className: "bg-ng-leaf/18 text-ng-forest-deep" },
  generated: { tag: "Generated", hint: "From the gallery manifest in code — not editable here", className: "bg-ng-clay/20 text-ng-clay-deep" },
  nutrition: { tag: "Nutrition", hint: "Swaps with the pack size the shopper selects", className: "bg-ng-sage/60 text-ng-forest-deep" },
};

export function PdpImagesPreview({ productId }: { productId: string }) {
  /*
   * One state object carrying the id it belongs to, rather than separate
   * data / error / loading flags.
   *
   * Those three would each need resetting at the top of the effect when the id
   * changes, and a setState called straight from an effect body is the pattern
   * react-hooks/set-state-in-effect exists to stop — it schedules an extra
   * render pass on every run. Stamping the result with its own id instead means
   * nothing has to be cleared: a result whose stamp no longer matches the
   * current product is simply not this product's result, and "loading" is what
   * that gap looks like.
   */
  const [state, setState] = useState<{ id: string; data: Payload | null; error: string | null }>({
    id: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetch(`/api/admin/inventory/products/${productId}/pdp-images`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Payload) => {
        if (!cancelled) setState({ id: productId, data: j, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ id: productId, data: null, error: "Couldn't load the composed gallery." });
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Only trust a result stamped with the product we are currently showing.
  const current = state.id === productId ? state : { data: null, error: null };
  const data = current.data;
  const error = current.error;
  const loading = !data && !error;

  if (!productId) return null;

  return (
    <div className="rounded-2xl border border-ng-line-soft bg-ng-paper/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ng-forest-deep">On the product page</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ng-ink-muted">
            Every slide the shopper will swipe, in order — including ones this form does not control.
          </p>
        </div>
        {data ? (
          <span className="shrink-0 rounded-full bg-ng-sage/50 px-2.5 py-1 text-[11px] font-semibold text-ng-forest-deep">
            {data.total} slide{data.total === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {loading ? <p className="mt-3 text-[12px] text-ng-ink-muted">Loading…</p> : null}
      {error ? <p className="mt-3 text-[12px] text-ng-danger">{error}</p> : null}

      {data && data.duplicates > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-ng-amber/12 px-3 py-2 text-[11px] leading-snug text-ng-amber">
          <Icon name="danger-triangle-bold" size={14} className="mt-px shrink-0" />
          <span>
            {data.duplicates} slide{data.duplicates === 1 ? " is" : "s are"} listed twice. A path already
            supplied by the manifest will show again if you also add it to the gallery — remove it above.
          </span>
        </p>
      ) : null}

      {data ? (
        <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {data.slides.map((s, i) => {
            const copy = SOURCE_COPY[s.source];
            return (
              <li key={`${s.src}-${i}`} className="min-w-0">
                <div
                  title={`${s.label} — ${copy.hint}`}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border bg-ng-paper",
                    s.duplicateOf ? "border-ng-amber ring-1 ring-ng-amber/40" : "border-ng-line-soft",
                  )}
                >
                  <Image src={s.src} alt={s.label} fill sizes="120px" className="object-contain" />
                  <span className="absolute left-1 top-1 rounded-full bg-ng-forest-deep/75 px-1.5 text-[10px] font-semibold text-ng-paper">
                    {i + 1}
                  </span>
                  {!s.editable ? (
                    <span className="absolute right-1 top-1 rounded-full bg-ng-forest-deep/70 p-1 text-ng-paper">
                      <Icon name="lock-keyhole-minimalistic-bold" size={10} />
                    </span>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "mt-1 block truncate rounded-full px-2 py-0.5 text-center text-[10px] font-semibold",
                    copy.className,
                  )}
                >
                  {copy.tag}
                </span>
                <span className="mt-0.5 block truncate text-center text-[10px] text-ng-ink-muted">
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {data && data.nutritionSizes.length > 0 ? (
        <p className="mt-3 text-[11px] text-ng-ink-muted">
          Nutrition panel swaps by pack size: {data.nutritionSizes.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
