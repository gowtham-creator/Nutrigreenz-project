import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { INR, itemCount, STATUS_TONE } from "@/components/ng/admin/orders-data";
import { formatDeliveryDate } from "./bundle-data";
import type { BundleGroup } from "./bundle-data";

/**
 * One gated-community + delivery-date bundle. Informational/operational only:
 * shows the customers in the group, the consolidated SKU pick-list the operator
 * packs against, and the summed value. No re-pricing or auto-merging happens.
 */
export function BundleCard({ group }: { group: BundleGroup }) {
  const single = group.orders.length === 1;

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 border-b border-ng-line-soft bg-ng-cream/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="home-2-bold" size={18} className="text-ng-forest" />
            <h2 className="font-display text-[20px] text-ng-forest-deep leading-tight">{group.community}</h2>
          </div>
          <div className="text-[12px] text-ng-ink-soft mt-1.5">
            {group.area} · <span className="font-mono">{group.pincode}</span> · {group.city}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Pill tone="info">{formatDeliveryDate(group.deliveryDate)}</Pill>
          {group.slots.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-ng-paper border border-ng-line-soft px-2.5 py-1 text-[11px] text-ng-ink-muted"
            >
              <Icon name="clock-circle-bold" size={12} className="text-ng-clay-deep" />
              {s}
            </span>
          ))}
          <Pill tone={single ? "neutral" : "success"}>
            {single ? "Bundle of 1" : `${group.orders.length} orders`}
          </Pill>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* Customer rows */}
        <div className="px-6 py-5 lg:border-r border-ng-line-soft">
          <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium mb-3">
            Customers in this bundle
          </div>
          <ul>
            {group.orders.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 py-2.5 border-b border-ng-line-soft last:border-0 text-[13px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ng-ink">{o.customer.name}</div>
                  <div className="font-mono text-[11px] text-ng-ink-soft mt-0.5">{o.id}</div>
                </div>
                <span className="text-[11.5px] text-ng-ink-muted whitespace-nowrap">
                  {itemCount(o)} {itemCount(o) === 1 ? "item" : "items"}
                </span>
                <span className="font-medium text-ng-ink whitespace-nowrap w-20 text-right">{INR(o.total)}</span>
                <span className="w-28 flex justify-end">
                  <Pill tone={STATUS_TONE[o.status]}>{o.status}</Pill>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Consolidated SKU totals */}
        <div className="px-6 py-5 bg-ng-paper">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-ng-ink-soft font-medium mb-3">
            <Icon name="box-bold" size={13} className="text-ng-forest" />
            Consolidated SKU totals
          </div>
          <ul className="space-y-2">
            {group.consolidated.map((c) => (
              <li key={`${c.sku}-${c.unit}`} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="min-w-0">
                  <span className="text-ng-ink">{c.title}</span>{" "}
                  <span className="text-ng-ink-soft">{c.unit}</span>
                  <span className="block font-mono text-[10.5px] text-ng-ink-soft/80">{c.sku}</span>
                </span>
                <span className="font-display text-[15px] text-ng-forest-deep whitespace-nowrap">×{c.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer: bundle total + informational note */}
      <footer className="px-6 py-4 border-t border-ng-line-soft flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-[11.5px] text-ng-ink-soft max-w-xl">
          <Icon name="info-circle-bold" size={14} className="text-ng-clay-deep mt-px" />
          <span>
            Informational only — no re-pricing or auto-merging. The client decides individual vs bundled packing;
            each order keeps its own value &amp; status.
          </span>
        </p>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-wider text-ng-ink-soft">Bundle value</div>
          <div className="font-display text-[22px] text-ng-forest-deep leading-none mt-0.5">{INR(group.bundleTotal)}</div>
        </div>
      </footer>
    </Card>
  );
}
