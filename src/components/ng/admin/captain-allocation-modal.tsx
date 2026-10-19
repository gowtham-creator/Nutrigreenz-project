"use client";

/**
 * Allocate stall products to a captain.
 *
 * Before this, the captain app sold a hardcoded six-item list whose SKUs
 * matched nothing in the catalogue, so an operator had no way to control what a
 * captain could sell — and the cash they took could not be reconciled against a
 * real product.
 *
 * Allocation is per VARIANT because that is what carries the price and stock.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { UiIcon } from "@/components/ui/ui-icon";

interface VariantRow {
  id: string;
  productName: string;
  label: string;
  pack: string | null;
  sku: string | null;
  pricePaise: number;
  available: number;
}

export function CaptainAllocationModal({
  captainId,
  captainName,
  onClose,
}: {
  captainId: string;
  captainName: string;
  onClose: () => void;
}) {
  const [variants, setVariants] = useState<VariantRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        // One round trip: the sellable catalogue and this captain's current
        // selection come back together.
        const res = await fetch(`/api/admin/captains/${captainId}/allocations`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("load");
        const data = (await res.json()) as { variants?: VariantRow[]; variantIds?: string[] };
        if (!alive) return;
        setVariants(data.variants ?? []);
        setSelected(new Set(data.variantIds ?? []));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [captainId]);

  // Escape + scroll lock, matching the other admin modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const shown = (variants ?? []).filter(
    (v) =>
      !q ||
      v.productName.toLowerCase().includes(q) ||
      (v.sku ?? "").toLowerCase().includes(q) ||
      v.label.toLowerCase().includes(q),
  );

  const byProduct = new Map<string, VariantRow[]>();
  for (const v of shown) {
    const bucket = byProduct.get(v.productName);
    if (bucket) bucket.push(v);
    else byProduct.set(v.productName, [v]);
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/captains/${captainId}/allocations`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [...selected].map((variantId) => ({ variantId })),
        }),
      });
      if (!res.ok) throw new Error("save");
      toast.success("Products saved", {
        description:
          selected.size === 0
            ? `${captainName} cannot sell anything until you assign products.`
            : `${captainName} can now sell ${selected.size} product${selected.size === 1 ? "" : "s"}.`,
      });
      onClose();
    } catch {
      toast.error("Products not saved", { description: "Check your connection, then save again." });
    } finally {
      setSaving(false);
    }
  }

  /*
   * Portaled to <body>. `backdrop-filter` on the admin shell header and the
   * sticky page bars establishes a containing block, so a fixed overlay left
   * in place is positioned against that card rather than the viewport — it
   * opens low and runs off the bottom edge.
   */
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-pointer bg-ng-forest-deep/30 backdrop-blur-[1px]"
      />
      <div className="relative flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Stall products for ${captainName}`}
          className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-ng-line-soft bg-ng-cream shadow-[var(--shadow-ng-modal)]"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ng-line-soft bg-ng-paper px-4 sm:px-6 py-5">
            <div className="min-w-0">
              <h2 className="font-display text-[20px] leading-tight text-ng-forest-deep">
                Stall products
              </h2>
              <p className="mt-1 text-[12px] font-medium text-ng-ink-soft">
                Choose what {captainName} can sell at the stall.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ng-ink-soft transition-colors hover:bg-ng-line-soft hover:text-ng-forest-deep"
            >
              <Icon name="close-circle-bold" size={20} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 sm:px-6 py-5">
            {failed ? (
              <p className="rounded-xl border border-ng-danger/40 bg-ng-danger/5 px-3 py-2.5 text-[12.5px] text-ng-danger">
                The product list did not load. Close this and open it again. Saving is
                turned off so this captain&rsquo;s current products are not cleared.
              </p>
            ) : variants === null ? (
              <p className="text-[13px] text-ng-ink-muted">Loading products…</p>
            ) : (
              <>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ng-ink-soft">
                    <UiIcon name="search" size={15} />
                  </span>
                  <input
                    type="search"
                    aria-label="Search products"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by product, size or SKU"
                    className="h-11 w-full rounded-xl border border-ng-line-soft bg-ng-paper pl-9 pr-3 text-[13px] text-ng-ink outline-none transition-colors placeholder:text-ng-ink-soft focus:border-ng-forest"
                  />
                </div>

                {[...byProduct.entries()].map(([product, rows]) => (
                  <div
                    key={product}
                    className="overflow-hidden rounded-xl border border-ng-line-soft bg-ng-paper"
                  >
                    <p className="border-b border-ng-line-soft px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ng-ink-muted">
                      {product}
                    </p>
                    {rows.map((v) => {
                      const on = selected.has(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggle(v.id)}
                          aria-pressed={on}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ng-forest",
                            on ? "bg-ng-forest/10" : "hover:bg-ng-sage/25",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded border",
                              on ? "border-ng-forest bg-ng-forest text-ng-cream" : "border-ng-line",
                            )}
                          >
                            {on ? <UiIcon name="verified" size={11} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 text-[13px] text-ng-ink">
                            {v.label}
                            {v.pack ? (
                              <span className="text-ng-ink-muted"> · {v.pack}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ng-forest">
                            ₹{(v.pricePaise / 100).toLocaleString("en-IN", {
                              minimumFractionDigits: v.pricePaise % 100 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span
                            className={cn(
                              "w-[5.5rem] shrink-0 text-right text-[11.5px] tabular-nums",
                              v.available === 0 ? "text-ng-danger" : "text-ng-ink-soft",
                            )}
                          >
                            {v.available === 0 ? "None in stock" : `${v.available} in stock`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ng-line-soft bg-ng-paper px-4 sm:px-6 py-4">
            <p className="text-[12px] text-ng-ink-muted">
              {selected.size === 0
                ? "Nothing selected. This captain will not be able to sell anything."
                : `${selected.size} SKU${selected.size === 1 ? "" : "s"} selected`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 cursor-pointer rounded-full border border-ng-line px-4 text-[12.5px] font-medium text-ng-ink transition-colors hover:bg-ng-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || failed || variants === null}
                onClick={() => void save()}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-ng-forest-deep px-4 text-[12.5px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="save" size={15} />
                {saving ? "Saving…" : "Save products"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
