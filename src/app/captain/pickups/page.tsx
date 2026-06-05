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

/** Progression order for the per-stop stepper. */
const STAGES: Status[] = ["Due", "Collected", "Handed over"];

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
  const collectedCount = pickups.filter((p) => p.status === "Collected").length;
  const doneCount = pickups.filter((p) => p.status === "Handed over").length;
  const totalOrders = pickups.reduce((s, p) => s + p.orders, 0);
  // First DUE stop on the route — the captain's immediate next action.
  const nextStop = pickups.find((p) => p.status === "Due");

  return (
    <CaptainShell
      eyebrow="Route · community bundles"
      title="Pickups"
      subtitle={`${dueCount} due · ${pickups.length} bundles on your route today`}
    >
      {/* Route summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <RouteStat label="Due" value={dueCount} tone="clay" icon="box-bold" />
        <RouteStat label="Collected" value={collectedCount} tone="leaf" icon="bag-check-bold" />
        <RouteStat label="Orders" value={totalOrders} tone="forest" icon="checklist-minimalistic-bold" />
      </div>

      {/* Next stop emphasis */}
      {nextStop && filter !== "Done" ? (
        <div className="relative overflow-hidden rounded-2xl bg-ng-forest-deep text-ng-cream p-4 mb-5">
          <div className="absolute -top-12 -right-10 size-36 rounded-full bg-ng-clay/20 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/25 ring-1 ring-ng-clay/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ng-clay">
                <Icon name="map-point-wave-bold" size={12} />
                Next stop
              </span>
              <span className="text-[11px] text-ng-cream/55">{nextStop.slot}</span>
            </div>
            <div className="font-display text-[19px] text-ng-cream mt-2.5 leading-tight">{nextStop.community}</div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-ng-cream/65 mt-1.5">
              <Icon name="box-minimalistic-linear" size={13} />
              {nextStop.items}
            </div>
            <div className="mt-3.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => toast.info(`Opening route to ${nextStop.community}`)}
                className="flex items-center justify-center gap-1.5 rounded-full bg-ng-cream/10 ring-1 ring-ng-cream/15 text-ng-cream px-4 py-2.5 text-[12.5px] font-semibold cursor-pointer hover:bg-ng-cream/15 transition-colors"
              >
                <Icon name="map-point-wave-linear" size={15} />
                Navigate
              </button>
              <button
                type="button"
                onClick={() => advance(nextStop.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold py-2.5 text-[13.5px] cursor-pointer hover:bg-ng-green-bright transition-colors active:scale-[0.98] shadow-[0_8px_20px_-8px_rgba(102,191,115,0.7)]"
              >
                <Icon name="box-bold" size={16} />
                Collect {nextStop.orders} orders
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {(["All", "Due", "Done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-4 py-1.5 rounded-full text-[12.5px] cursor-pointer transition-colors ${
              filter === f
                ? "bg-ng-forest text-ng-cream font-bold"
                : "bg-ng-white border border-ng-line text-ng-ink-muted hover:border-ng-leaf"
            }`}
          >
            {f}
            {f === "Due" && dueCount > 0 ? <span className="ml-1 opacity-70">·{dueCount}</span> : null}
            {f === "Done" && doneCount > 0 ? <span className="ml-1 opacity-70">·{doneCount}</span> : null}
          </button>
        ))}
      </div>

      {/* Route list with connecting rail */}
      <div className="relative">
        {visible.length > 1 ? (
          <div className="absolute left-[19px] top-6 bottom-6 w-px bg-ng-line" aria-hidden />
        ) : null}
        <div className="space-y-3">
          {visible.map((p) => {
            const stageIdx = STAGES.indexOf(p.status);
            return (
              <div key={p.id} className="relative flex gap-3">
                {/* route node */}
                <div className="shrink-0 pt-4">
                  <span
                    className={`relative z-10 flex size-10 items-center justify-center rounded-full ring-4 ring-ng-paper ${
                      p.status === "Handed over"
                        ? "bg-ng-forest text-ng-cream"
                        : p.status === "Collected"
                          ? "bg-ng-leaf/25 text-ng-forest"
                          : "bg-ng-clay/20 text-ng-clay-deep"
                    }`}
                  >
                    <Icon
                      name={p.status === "Handed over" ? "check-circle-bold" : "box-bold"}
                      size={19}
                    />
                  </span>
                </div>

                <CaptainCard className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[15px] text-ng-forest-deep leading-tight">
                          {p.community}
                        </span>
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

                  {/* stage stepper */}
                  <div className="mt-3 flex items-center gap-1.5">
                    {STAGES.map((s, i) => (
                      <div key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
                        <span
                          className={`h-1.5 rounded-full transition-all ${
                            i <= stageIdx ? "bg-ng-leaf" : "bg-ng-line"
                          } ${i === 0 ? "w-2" : "flex-1"}`}
                        />
                      </div>
                    ))}
                    <span className="text-[10px] text-ng-ink-soft pl-1 shrink-0">
                      {stageIdx + 1}/3
                    </span>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-ng-line-soft grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => toast.info(`Opening route to ${p.community}`)}
                      className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-paper border border-ng-line text-ng-ink cursor-pointer hover:border-ng-leaf transition-colors"
                    >
                      <Icon name="map-point-wave-linear" size={15} />
                      Route
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("Calling community coordinator")}
                      className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-paper border border-ng-line text-ng-ink cursor-pointer hover:border-ng-leaf transition-colors"
                    >
                      <Icon name="phone-linear" size={15} />
                      Call
                    </button>
                    {p.status === "Handed over" ? (
                      <span className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-sage/40 text-ng-forest font-bold">
                        <Icon name="check-circle-bold" size={15} />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => advance(p.id)}
                        className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2 rounded-lg bg-ng-forest text-ng-cream font-bold cursor-pointer hover:bg-ng-forest-deep transition-colors active:scale-[0.98]"
                      >
                        <Icon name={p.status === "Due" ? "box-bold" : "hand-stars-bold"} size={15} />
                        {p.status === "Due" ? "Collect" : "Hand over"}
                      </button>
                    )}
                  </div>
                </CaptainCard>
              </div>
            );
          })}

          {visible.length === 0 ? (
            <CaptainCard tone="sage" className="text-center py-8">
              <Icon name="check-circle-bold" size={30} className="text-ng-forest mx-auto" />
              <p className="text-[13px] text-ng-forest-deep mt-2 font-semibold">Nothing here</p>
              <p className="text-[12px] text-ng-ink-muted mt-1">No pickups match this filter.</p>
            </CaptainCard>
          ) : null}
        </div>
      </div>
    </CaptainShell>
  );
}

function RouteStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "clay" | "leaf" | "forest";
  icon: string;
}) {
  const map = {
    clay: "bg-ng-clay/12 border-ng-clay/30 text-ng-clay-deep",
    leaf: "bg-ng-sage/45 border-ng-line text-ng-forest",
    forest: "bg-ng-forest text-ng-cream border-ng-forest",
  } as const;
  const iconTone = tone === "forest" ? "text-ng-leaf" : tone === "leaf" ? "text-ng-forest" : "text-ng-clay-deep";
  const valTone = tone === "forest" ? "text-ng-cream" : "text-ng-forest-deep";
  const labTone = tone === "forest" ? "text-ng-leaf-soft" : "text-ng-ink-soft";
  return (
    <div className={`rounded-2xl border px-3 py-3 ${map[tone]}`}>
      <Icon name={icon} size={18} className={iconTone} />
      <div className={`font-display text-[22px] leading-none mt-2 ${valTone}`}>{value}</div>
      <div className={`text-[10px] uppercase tracking-wider mt-1 ${labTone}`}>{label}</div>
    </div>
  );
}
