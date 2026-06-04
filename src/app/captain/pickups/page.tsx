"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CaptainShell, CaptainCard } from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";

type Status = "Due" | "Collected" | "Handed over";

interface Pickup {
  id: string;
  community: string;
  slot: string;
  orders: number;
  items: string;
  status: Status;
}

const INITIAL: Pickup[] = [
  {
    id: "BND-Avatar-0604",
    community: "My Home Avatar",
    slot: "Today · 5–7 PM",
    orders: 12,
    items: "9 oils · 6 millet · 4 ghee · 3 honey",
    status: "Due",
  },
  {
    id: "BND-Aparna-0604",
    community: "Aparna Sarovar Zenith",
    slot: "Today · 6–8 PM",
    orders: 8,
    items: "5 oils · 4 superfood · 2 ghee",
    status: "Collected",
  },
  {
    id: "BND-Lodha-0604",
    community: "Lodha Bellezza",
    slot: "Today · 7–9 PM",
    orders: 6,
    items: "4 oils · 3 honey · 2 millet",
    status: "Due",
  },
  {
    id: "BND-Manjeera-0605",
    community: "Manjeera Trinity",
    slot: "Tomorrow · 5–7 PM",
    orders: 9,
    items: "7 oils · 5 millet · 3 superfood",
    status: "Due",
  },
];

const STATUS_STYLE: Record<Status, string> = {
  Due: "bg-ng-clay/25 text-ng-clay-deep",
  Collected: "bg-ng-leaf/25 text-ng-forest",
  "Handed over": "bg-ng-forest text-ng-cream",
};

export default function CaptainPickups() {
  const [pickups, setPickups] = useState<Pickup[]>(INITIAL);
  const [filter, setFilter] = useState<"All" | "Due" | "Done">("All");

  function advance(id: string) {
    setPickups((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.status === "Due") {
          toast.success(`${p.community} marked collected`, { description: `${p.orders} orders picked from hub` });
          return { ...p, status: "Collected" };
        }
        if (p.status === "Collected") {
          toast.success(`${p.community} handed over`, { description: "Community pickup complete" });
          return { ...p, status: "Handed over" };
        }
        return p;
      }),
    );
  }

  const visible = pickups.filter((p) =>
    filter === "All" ? true : filter === "Due" ? p.status === "Due" : p.status !== "Due",
  );
  const dueCount = pickups.filter((p) => p.status === "Due").length;

  return (
    <CaptainShell
      eyebrow="Community bundles"
      title="Pickups"
      subtitle={`${dueCount} due · ${pickups.length} bundles assigned to you`}
    >
      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {(["All", "Due", "Done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] transition-colors ${
              filter === f
                ? "bg-ng-forest text-ng-cream font-semibold"
                : "bg-ng-white border border-ng-line text-ng-ink-muted hover:border-ng-leaf"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((p) => (
          <CaptainCard key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-[15px] text-ng-forest-deep leading-tight">{p.community}</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider font-bold ${STATUS_STYLE[p.status]}`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-ng-ink-muted mt-1.5">
                  <Icon name="clock-circle-linear" size={13} className="text-ng-ink-soft" />
                  {p.slot}
                </div>
                <div className="text-[11.5px] text-ng-ink-soft font-mono mt-1">{p.id}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-[20px] text-ng-forest-deep leading-none">{p.orders}</div>
                <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft mt-1">orders</div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-1.5 text-[12px] text-ng-ink-muted">
              <Icon name="box-minimalistic-linear" size={14} className="text-ng-ink-soft mt-0.5 shrink-0" />
              <span>{p.items}</span>
            </div>

            <div className="mt-3.5 pt-3 border-t border-ng-line-soft grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => toast.info(`Opening route to ${p.community}`)}
                className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-paper border border-ng-line text-ng-ink hover:border-ng-leaf transition-colors"
              >
                <Icon name="map-point-wave-linear" size={15} />
                Route
              </button>
              <button
                type="button"
                onClick={() => toast.info("Calling community coordinator")}
                className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-paper border border-ng-line text-ng-ink hover:border-ng-leaf transition-colors"
              >
                <Icon name="phone-linear" size={15} />
                Call
              </button>
              {p.status === "Handed over" ? (
                <span className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-sage/40 text-ng-forest font-semibold">
                  <Icon name="check-circle-bold" size={15} />
                  Done
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => advance(p.id)}
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-forest text-ng-cream font-semibold hover:bg-ng-forest-deep transition-colors"
                >
                  <Icon name={p.status === "Due" ? "box-bold" : "hand-stars-bold"} size={15} />
                  {p.status === "Due" ? "Collect" : "Hand over"}
                </button>
              )}
            </div>
          </CaptainCard>
        ))}

        {visible.length === 0 ? (
          <CaptainCard tone="sage" className="text-center py-8">
            <Icon name="check-circle-bold" size={30} className="text-ng-forest mx-auto" />
            <p className="text-[13px] text-ng-forest-deep mt-2 font-medium">Nothing here</p>
            <p className="text-[12px] text-ng-ink-muted mt-1">No pickups match this filter.</p>
          </CaptainCard>
        ) : null}
      </div>
    </CaptainShell>
  );
}
