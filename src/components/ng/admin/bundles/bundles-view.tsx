"use client";

import { useMemo, useState } from "react";
import { StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { INR } from "@/components/ng/admin/orders-data";
import { BundleCard } from "./bundle-card";
import { bundleDeliveryDates, buildBundleGroups, formatDeliveryDate } from "./bundle-data";

/**
 * Interactive Community-Bundle view (§3.11). Builds groups from the shared
 * dataset, exposes a delivery-date chip filter, and renders one BundleCard per
 * gated-community + delivery-date group (soonest date first).
 */
export function BundlesView() {
  const allGroups = useMemo(() => buildBundleGroups(), []);
  const dates = useMemo(() => bundleDeliveryDates(allGroups), [allGroups]);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const groups = useMemo(
    () => (activeDate ? allGroups.filter((g) => g.deliveryDate === activeDate) : allGroups),
    [allGroups, activeDate],
  );

  const bundledOrders = groups.reduce((n, g) => n + g.orders.length, 0);
  const bundledValue = groups.reduce((n, g) => n + g.bundleTotal, 0);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Active bundles" value={String(groups.length)} />
        <StatTile label="Orders bundled" value={String(bundledOrders)} />
        <StatTile label="Bundled value" value={INR(bundledValue)} />
        <StatTile label="Delivery dates" value={String(dates.length)} />
      </div>

      {/* Delivery-date filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-[12px] text-ng-ink-soft mr-1 flex items-center gap-1.5">
          <Icon name="calendar-bold" size={14} className="text-ng-forest" />
          Delivery date:
        </span>
        <button
          onClick={() => setActiveDate(null)}
          className={`px-3.5 py-1.5 rounded-full text-[12px] transition-colors ${
            activeDate === null
              ? "bg-ng-forest-deep text-ng-cream font-semibold"
              : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted hover:bg-ng-cream"
          }`}
        >
          All dates
        </button>
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDate(d)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] transition-colors ${
              activeDate === d
                ? "bg-ng-forest-deep text-ng-cream font-semibold"
                : "bg-ng-paper border border-ng-line-soft text-ng-ink-muted hover:bg-ng-cream"
            }`}
          >
            {formatDeliveryDate(d)}
          </button>
        ))}
      </div>

      {/* Bundle cards */}
      {groups.length === 0 ? (
        <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-10 text-center text-[13px] text-ng-ink-soft">
          No confirmed orders to bundle for this date.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <BundleCard key={g.key} group={g} />
          ))}
        </div>
      )}
    </>
  );
}
