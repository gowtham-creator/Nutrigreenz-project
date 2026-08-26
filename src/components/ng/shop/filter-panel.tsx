"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CATEGORY_TAGS, type ShopFilters } from "./types";

interface FilterPanelProps {
  filters: ShopFilters;
  onChange: (next: ShopFilters) => void;
  /** absolute price bounds of the catalog */
  bounds: { min: number; max: number };
  /** count of products per tag, for the facet badges */
  tagCounts: Record<string, number>;
  /** the category facets to render; defaults to the bundled `CATEGORY_TAGS` */
  categoryTags?: { tag: string; label: string }[];
  /** total products in the pool, for the "All categories" badge */
  totalCount?: number;
  /** when true, the category facet is hidden (e.g. on a category page) */
  hideCategories?: boolean;
  onReset?: () => void;
  className?: string;
}

const RATINGS = [4.5, 4, 3];

export function FilterPanel({
  filters,
  onChange,
  bounds,
  tagCounts,
  categoryTags = CATEGORY_TAGS,
  totalCount,
  hideCategories,
  onReset,
  className,
}: FilterPanelProps) {
  const toggleTag = (tag: string) => {
    const has = filters.tags.includes(tag);
    onChange({
      ...filters,
      tags: has ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag],
    });
  };

  /*
   * Thumb positions as percentages, for the filled span between them.
   * `span` is guarded because bounds.min === bounds.max whenever the catalogue
   * has a single price (or one product), which would otherwise divide by zero
   * and put the fill at NaN%.
   */
  const span = Math.max(1, bounds.max - bounds.min);
  const pct = (v: number) =>
    Math.min(100, Math.max(0, ((v - bounds.min) / span) * 100));
  const minPct = pct(filters.priceMin);
  const maxPct = pct(filters.priceMax);

  return (
    <div className={cn("space-y-7", className)}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-[20px] text-ng-forest-deep">
          <Icon name="settings" size={18} className="text-ng-clay" />
          Refine
        </h3>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            /* Was `text-ng-leaf` at weight 500: a mid-green on cream, around
               2.3:1, which fails WCAG AA for body text and read as disabled.
               Ink at semibold gives it the contrast and weight of a control
               that can actually be pressed, with the underline on hover
               marking it as the destructive-ish action it is. */
            className="rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-ng-ink underline-offset-4 transition-colors hover:text-ng-forest hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest"
          >
            Reset
          </button>
        ) : null}
      </div>

      {/* Categories */}
      {!hideCategories ? (
        <fieldset className="space-y-2.5">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
            Category
          </legend>
          {(() => {
            const allChecked = filters.tags.length === 0;
            return (
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ng-ink-muted hover:text-ng-ink">
                <span
                  className={cn(
                    "grid h-[18px] w-[18px] place-items-center rounded-[6px] border transition-colors",
                    allChecked ? "border-ng-forest bg-ng-forest text-ng-paper" : "border-ng-line bg-ng-paper",
                  )}
                >
                  {allChecked ? <Icon name="check-read-linear" size={12} /> : null}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={allChecked}
                  onChange={() => onChange({ ...filters, tags: [] })}
                />
                <span className="flex-1">All categories</span>
                {typeof totalCount === "number" ? (
                  <span className="text-[12px] text-ng-ink-muted/70">{totalCount}</span>
                ) : null}
              </label>
            );
          })()}
          {categoryTags.map(({ tag, label }) => {
            const count = tagCounts[tag] ?? 0;
            if (count === 0) return null;
            const checked = filters.tags.includes(tag);
            return (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ng-ink-muted hover:text-ng-ink"
              >
                <span
                  className={cn(
                    "grid h-[18px] w-[18px] place-items-center rounded-[6px] border transition-colors",
                    checked ? "border-ng-forest bg-ng-forest text-ng-paper" : "border-ng-line bg-ng-paper",
                  )}
                >
                  {checked ? <Icon name="check-read-linear" size={12} /> : null}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleTag(tag)}
                />
                <span className="flex-1">{label}</span>
                <span className="text-[12px] text-ng-ink-muted/70">{count}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {/* Price range */}
      <fieldset className="space-y-3">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
          Price range
        </legend>
        {/* The two values, shown as chips so they read as the current
            selection rather than as the fixed bounds of the scale. */}
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="rounded-lg bg-ng-sage/40 px-2.5 py-1 font-semibold tabular-nums text-ng-forest-deep">
            ₹{filters.priceMin.toLocaleString("en-IN")}
          </span>
          <span className="h-px flex-1 bg-ng-line" aria-hidden />
          <span className="rounded-lg bg-ng-sage/40 px-2.5 py-1 font-semibold tabular-nums text-ng-forest-deep">
            ₹{filters.priceMax.toLocaleString("en-IN")}
          </span>
        </div>

        {/*
          One track, two thumbs.
          The inputs are transparent and stacked over the track we draw below,
          because there is no two-thumb range control in HTML. See `.ng-range`
          in globals.css for why the thumbs need `pointer-events: auto` while
          the inputs themselves are `none`.
        */}
        <div className="relative h-6 select-none">
          {/* Unselected track */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ng-line" />
          {/* Selected span, so the chosen range is legible at a glance */}
          <div
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ng-forest"
            style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
          />
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            value={filters.priceMin}
            aria-label="Minimum price"
            onChange={(e) =>
              onChange({ ...filters, priceMin: Math.min(Number(e.target.value), filters.priceMax) })
            }
            className="ng-range absolute inset-0 h-full w-full touch-manipulation"
          />
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            value={filters.priceMax}
            aria-label="Maximum price"
            onChange={(e) =>
              onChange({ ...filters, priceMax: Math.max(Number(e.target.value), filters.priceMin) })
            }
            className="ng-range absolute inset-0 h-full w-full touch-manipulation"
          />
        </div>
        {/* Numeric fallback for precise bounds on touch — sliders alone are hard
            to set exactly on a phone. Hidden on desktop where the sidebar is shown. */}
        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            value={filters.priceMin}
            aria-label="Minimum price"
            onChange={(e) =>
              onChange({
                ...filters,
                priceMin: Math.min(Number(e.target.value) || bounds.min, filters.priceMax),
              })
            }
            className="h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] tabular-nums text-ng-ink"
          />
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            value={filters.priceMax}
            aria-label="Maximum price"
            onChange={(e) =>
              onChange({
                ...filters,
                priceMax: Math.max(Number(e.target.value) || bounds.max, filters.priceMin),
              })
            }
            className="h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] tabular-nums text-ng-ink"
          />
        </div>
      </fieldset>

      {/* Rating */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
          Customer rating
        </legend>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => {
            const active = filters.minRating === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ ...filters, minRating: active ? 0 : r })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                  active
                    ? "border-ng-forest bg-ng-forest text-ng-paper"
                    : "border-ng-line bg-ng-paper text-ng-ink-muted hover:border-ng-leaf",
                )}
              >
                <Icon name="star" size={12} className={active ? "text-ng-clay" : "text-ng-clay"} />
                {r}+
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* In stock */}
      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-ng-line-soft bg-ng-paper px-4 py-3">
        <span className="text-[13px] font-medium text-ng-ink">In stock only</span>
        <span
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            filters.inStockOnly ? "bg-ng-forest" : "bg-ng-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-ng-paper shadow-sm transition-transform",
              filters.inStockOnly ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={filters.inStockOnly}
          onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked })}
        />
      </label>
    </div>
  );
}
