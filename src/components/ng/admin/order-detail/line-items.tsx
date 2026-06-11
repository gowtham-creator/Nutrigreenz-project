"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { INR, type AdminOrderItem } from "@/components/ng/admin/orders-data";

/**
 * Line-items table with per-row editable lot codes. Lot edits are kept in local
 * state and committed (mock) via "Save lots" → toast. The known lot pool is
 * offered as datalist suggestions so operators can pick a valid lot fast.
 */

const KNOWN_LOTS = ["ANT-24-038", "ANT-24-044", "ANT-24-049", "ANT-24-051"];

export function LineItems({ items }: { items: AdminOrderItem[] }) {
  const [lots, setLots] = useState<string[]>(() => items.map((it) => it.lot));
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);

  function saveLots() {
    toast.success("Lots saved", {
      description: `${items.length} line item${items.length === 1 ? "" : "s"} updated with assigned lots.`,
    });
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-ng-line-soft">
        <div className="grid grid-cols-[2.6fr_0.6fr_1fr_1.6fr] gap-3 px-4 py-2.5 bg-ng-cream text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Amount</span>
          <span>Lot assignment</span>
        </div>
        <ul>
          {items.map((it, i) => (
            <li
              key={it.sku}
              className="grid grid-cols-[2.6fr_0.6fr_1fr_1.6fr] gap-3 px-4 py-3 items-center border-t border-ng-line-soft text-[13px]"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-ng-ink">{it.title}</div>
                <div className="text-[11.5px] font-medium text-ng-ink-soft mt-0.5">
                  <span className="font-mono">{it.sku}</span> · {it.unit} · {INR(it.price)}
                </div>
              </div>
              <span className="text-right font-medium text-ng-ink tabular-nums">×{it.qty}</span>
              <span className="text-right font-semibold text-ng-ink tabular-nums">{INR(it.price * it.qty)}</span>
              <div>
                <input
                  aria-label={`Lot for ${it.title}`}
                  list="ng-lot-pool"
                  value={lots[i]}
                  onChange={(e) =>
                    setLots((prev) => prev.map((l, idx) => (idx === i ? e.target.value : l)))
                  }
                  placeholder="Assign lot…"
                  className="w-full rounded-lg bg-ng-cream border border-ng-line-soft px-3 py-1.5 text-[12px] font-mono text-ng-forest-deep outline-none focus:border-ng-forest"
                />
              </div>
            </li>
          ))}
        </ul>
        <datalist id="ng-lot-pool">
          {KNOWN_LOTS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={saveLots}
          className="inline-flex items-center gap-2 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors"
        >
          <Icon name="diskette-bold" size={15} />
          Save lots
        </button>
        <div className="text-[13px] font-medium text-ng-ink-muted">
          Items subtotal <span className="font-semibold text-ng-ink tabular-nums ml-1">{INR(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
