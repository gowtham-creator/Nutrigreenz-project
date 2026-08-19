"use client";

/**
 * Pick products from the real catalogue.
 *
 * The coupon campaign builder has offered a "Product / SKU" targeting mode since
 * it was written, backed by a free-text box an operator typed names into. That
 * text was never stored and nothing enforced it, so a coupon marked
 * product-targeted discounted every order exactly like an untargeted one.
 *
 * This selects actual product ids, which is what the server matches order lines
 * against — a product can then be renamed without silently detargeting a live
 * campaign.
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { UiIcon } from "@/components/ui/ui-icon";

interface PickerProduct {
  id: string;
  name: string;
  categoryName: string | null;
  sku: string | null;
}

export function ProductPicker({
  value,
  onChange,
  label = "Products",
  hint,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const [products, setProducts] = useState<PickerProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/inventory/products?pageSize=200", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { products?: PickerProduct[] };
        if (alive) setProducts(data.products ?? []);
      } catch {
        // Show the failure rather than an empty list: an operator who sees
        // "no products" would reasonably assume the catalogue is empty and
        // save an untargeted coupon by mistake.
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (products ?? []).filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.categoryName ?? "").toLowerCase().includes(q),
    );
    const map = new Map<string, PickerProduct[]>();
    for (const p of list) {
      const key = p.categoryName ?? "Uncategorised";
      const bucket = map.get(key);
      if (bucket) bucket.push(p);
      else map.set(key, [p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, query]);

  const selected = new Set(value);
  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  const toggleCategory = (items: PickerProduct[]) => {
    const ids = items.map((p) => p.id);
    const allOn = ids.every((id) => selected.has(id));
    onChange(allOn ? value.filter((v) => !ids.includes(v)) : [...new Set([...value, ...ids])]);
  };

  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">
        {label}
      </label>
      {hint ? <p className="mb-2 text-[11.5px] text-ng-ink-soft">{hint}</p> : null}

      {failed ? (
        <p className="rounded-xl border border-ng-danger/40 bg-ng-danger/5 px-3 py-2.5 text-[12.5px] text-ng-danger">
          Couldn&rsquo;t load the catalogue. Reload before saving — otherwise this coupon
          would be saved with no products targeted.
        </p>
      ) : products === null ? (
        <p className="text-[12.5px] text-ng-ink-muted">Loading products…</p>
      ) : (
        <>
          <div className="relative mb-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ng-ink-soft">
              <UiIcon name="search" size={15} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a product, SKU or category…"
              className="h-10 w-full rounded-xl border border-ng-line-soft bg-ng-paper pl-9 pr-3 text-[13px] text-ng-ink outline-none transition-colors placeholder:text-ng-ink-soft focus:border-ng-forest"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-ng-line-soft bg-ng-paper">
            {grouped.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-ng-ink-muted">
                No products match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              grouped.map(([category, items]) => {
                const allOn = items.every((p) => selected.has(p.id));
                return (
                  <div key={category} className="border-b border-ng-line-soft last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleCategory(items)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-ng-sage/30"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ng-ink-muted">
                        {category}
                      </span>
                      <span className="text-[11px] font-semibold text-ng-forest">
                        {allOn ? "Clear all" : "Select all"}
                      </span>
                    </button>
                    {items.map((p) => {
                      const on = selected.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggle(p.id)}
                          aria-pressed={on}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                            on ? "bg-ng-forest/10" : "hover:bg-ng-sage/25",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-4 shrink-0 place-items-center rounded border",
                              on
                                ? "border-ng-forest bg-ng-forest text-ng-cream"
                                : "border-ng-line",
                            )}
                          >
                            {on ? <Icon name="check-circle-bold" size={11} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ng-ink">
                            {p.name}
                          </span>
                          {p.sku ? (
                            <span className="shrink-0 font-mono text-[10.5px] text-ng-ink-soft">
                              {p.sku}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <p className="mt-2 text-[11.5px] text-ng-ink-muted">
            {value.length === 0
              ? "No products selected. This coupon applies to every product."
              : `${value.length} product${value.length === 1 ? "" : "s"} selected. The code only applies when the cart contains one of them.`}
          </p>
        </>
      )}
    </div>
  );
}
