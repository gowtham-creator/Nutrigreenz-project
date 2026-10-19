"use client";

import { useEffect, useMemo, useState } from "react";
import { StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { formatPaise } from "@/app/admin/orders/portal-data";
import { BundleCard, formatDeliveryDate } from "./bundle-card";
import type { BundlesResult } from "@/lib/order-bundles";

/**
 * Interactive Community-Bundle view (§3.11). Loads the real pre-dispatch
 * bundle groups from `GET /api/admin/orders/bundles`, exposes a delivery-date
 * chip filter, and renders one BundleCard per gated-community + delivery-date
 * group (soonest date first). No mock data.
 */
export function BundlesView() {
  const [data, setData] = useState<BundlesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/orders/bundles");
      const json = (await res.json()) as { ok: boolean } & Partial<BundlesResult>;
      if (active && json.ok) {
        setData({
          groups: json.groups ?? [],
          deliveryDates: json.deliveryDates ?? [],
          totals: json.totals ?? { groups: 0, orders: 0, bundleTotalPaise: 0 },
        });
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const dates = data?.deliveryDates ?? [];

  const groups = useMemo(() => {
    const all = data?.groups ?? [];
    return activeDate ? all.filter((g) => g.deliveryDate === activeDate) : all;
  }, [data, activeDate]);

  const bundledOrders = groups.reduce((n, g) => n + g.orderCount, 0);
  const bundledValue = groups.reduce((n, g) => n + g.bundleTotalPaise, 0);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Active bundles" value={String(groups.length)} />
        <StatTile label="Orders bundled" value={String(bundledOrders)} />
        <StatTile label="Bundled value" value={formatPaise(bundledValue)} />
        <StatTile label="Delivery dates" value={String(dates.length)} />
      </div>

      {/* Delivery-date filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-[12px] font-medium text-ng-ink-muted mr-1 flex items-center gap-1.5">
          <Icon name="calendar-bold" size={14} className="text-ng-forest" />
          Delivery date:
        </span>
        <button
          onClick={() => setActiveDate(null)}
          className={`px-3.5 py-1.5 rounded-full text-[12px] transition-colors ${
            activeDate === null
              ? "bg-ng-forest-deep text-ng-cream font-semibold"
              : "bg-ng-paper border border-ng-line-soft font-medium text-ng-ink-muted hover:bg-ng-cream"
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
                : "bg-ng-paper border border-ng-line-soft font-medium text-ng-ink-muted hover:bg-ng-cream"
            }`}
          >
            {formatDeliveryDate(d)}
          </button>
        ))}
      </div>

      {/* Bundle cards */}
      {groups.length === 0 ? (
        <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-10 text-center text-[13px] font-medium text-ng-ink-muted">
          {loading ? "Loading community bundles…" : "No orders waiting for dispatch on this date."}
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
