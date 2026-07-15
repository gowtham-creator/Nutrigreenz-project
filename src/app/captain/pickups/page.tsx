"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CaptainShell,
  CaptainCard,
  CaptainHero,
  CaptainStat,
  CaptainEmpty,
} from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import {
  fetchCaptainPickups,
  advanceCaptainPickup,
  formatPickupWhen,
} from "@/components/ng/captain/captain-store";
import type { CaptainPickup, CaptainPickupStatus } from "@/types/nutrigreenz";

type UiStatus = "Due" | "Collected" | "Handed over";

/** DB status → the label the route UI renders. */
const UI_STATUS: Record<CaptainPickupStatus, UiStatus> = {
  due: "Due",
  collected: "Collected",
  handed_over: "Handed over",
};

// Monochrome-green progression: neutral (pending) → leaf (mid) → forest (done).
const STATUS_STYLE: Record<UiStatus, string> = {
  Due: "bg-ng-cream-deep text-ng-ink-muted",
  Collected: "bg-ng-leaf/25 text-ng-forest",
  "Handed over": "bg-ng-forest text-ng-cream",
};

/** Progression order for the per-stop stepper. */
const STAGES: UiStatus[] = ["Due", "Collected", "Handed over"];

/** The natural forward transition, mirroring the server's `nextPickupStatus`. */
const NEXT: Record<CaptainPickupStatus, CaptainPickupStatus | null> = {
  due: "collected",
  collected: "handed_over",
  handed_over: null,
};

export default function CaptainPickups() {
  const [pickups, setPickups] = useState<CaptainPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | "Due" | "Done">("All");
  const [advancing, setAdvancing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchCaptainPickups();
      if (!cancelled) {
        setPickups(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function advance(id: string) {
    const current = pickups.find((p) => p.id === id);
    if (!current) return;
    const next = NEXT[current.status];
    if (!next) return;

    setAdvancing(id);
    // Optimistic advance…
    setPickups((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
    try {
      const updated = await advanceCaptainPickup(id, next);
      setPickups((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success(
        next === "collected" ? `${current.community} marked collected` : `${current.community} handed over`,
        { description: next === "collected" ? "Picked from the community hub" : "Community pickup complete" },
      );
    } catch {
      // …revert on failure.
      setPickups((prev) => prev.map((p) => (p.id === id ? current : p)));
      toast.error("Couldn't update pickup", { description: "Check your connection and try again." });
    } finally {
      setAdvancing(null);
    }
  }

  const visible = pickups.filter((p) =>
    filter === "All" ? true : filter === "Due" ? p.status === "due" : p.status !== "due",
  );
  const dueCount = pickups.filter((p) => p.status === "due").length;
  const collectedCount = pickups.filter((p) => p.status === "collected").length;
  const doneCount = pickups.filter((p) => p.status === "handed_over").length;
  // First DUE stop on the route — the captain's immediate next action.
  const nextStop = pickups.find((p) => p.status === "due");

  return (
    <CaptainShell
      eyebrow="Route · community bundles"
      title="Pickups"
      subtitle={`${dueCount} due · ${pickups.length} bundles on your route today`}
    >
      {/* Route summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <CaptainStat label="Due" value={dueCount} icon="box-bold" />
        <CaptainStat label="Collected" value={collectedCount} icon="bag-check-bold" />
        <CaptainStat label="Done" value={doneCount} icon="check-circle-bold" />
      </div>

      {/* Next stop emphasis */}
      {nextStop && filter !== "Done" ? (
        <CaptainHero className="p-5 mb-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-leaf/15 ring-1 ring-ng-leaf/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ng-leaf">
              <Icon name="map-point-wave-bold" size={12} />
              Next stop
            </span>
            <span className="text-[11px] text-ng-cream/55">{formatPickupWhen(nextStop.dueAt)}</span>
          </div>
          <div className="font-display text-[19px] text-ng-cream mt-2.5 leading-tight">{nextStop.community}</div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-ng-cream/65 mt-1.5">
            <Icon name="box-minimalistic-linear" size={13} />
            {nextStop.address ?? "Community pickup"}
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toast.info(`Opening route to ${nextStop.community}`)}
              className="flex items-center justify-center gap-1.5 rounded-full bg-ng-cream/10 ring-1 ring-ng-cream/15 text-ng-cream px-4 py-3 text-[12.5px] font-semibold cursor-pointer hover:bg-ng-cream/15 transition-colors active:scale-[0.98]"
            >
              <Icon name="map-point-wave-linear" size={15} />
              Navigate
            </button>
            <button
              type="button"
              onClick={() => advance(nextStop.id)}
              disabled={advancing === nextStop.id}
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold py-3 text-[13.5px] cursor-pointer hover:bg-ng-green-bright transition-colors active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-ng-leaf shadow-[0_8px_20px_-8px_rgba(102,191,115,0.7)]"
            >
              <Icon name="box-bold" size={16} />
              Collect pickup
            </button>
          </div>
        </CaptainHero>
      ) : null}

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {(["All", "Due", "Done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-4 py-2.5 rounded-full text-[12.5px] font-semibold cursor-pointer transition-colors active:scale-[0.98] ${
              filter === f
                ? "bg-ng-forest text-ng-cream shadow-[0_6px_16px_-8px_rgba(20,51,31,0.55)]"
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
            const ui = UI_STATUS[p.status];
            const stageIdx = STAGES.indexOf(ui);
            return (
              <div key={p.id} className="relative flex gap-3">
                {/* route node */}
                <div className="shrink-0 pt-4">
                  <span
                    className={`relative z-10 flex size-10 items-center justify-center rounded-full ring-4 ring-ng-paper ${
                      p.status === "handed_over"
                        ? "bg-ng-forest text-ng-cream"
                        : p.status === "collected"
                          ? "bg-ng-leaf/25 text-ng-forest"
                          : "bg-ng-cream-deep text-ng-ink-muted"
                    }`}
                  >
                    <Icon
                      name={p.status === "handed_over" ? "check-circle-bold" : "box-bold"}
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
                          className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider font-bold ${STATUS_STYLE[ui]}`}
                        >
                          {ui}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-ng-ink-muted mt-1.5">
                        <Icon name="clock-circle-linear" size={13} className="text-ng-ink-soft" />
                        {formatPickupWhen(p.dueAt)}
                      </div>
                      <div className="text-[11.5px] text-ng-ink-soft font-mono mt-1">#{p.id.slice(0, 8)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-1.5 text-[12px] text-ng-ink-muted">
                    <Icon name="box-minimalistic-linear" size={14} className="text-ng-ink-soft mt-0.5 shrink-0" />
                    <span>{p.address ?? "Community pickup"}</span>
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
                      className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2.5 rounded-xl bg-ng-paper border border-ng-line text-ng-ink cursor-pointer hover:border-ng-leaf transition-colors active:scale-[0.98]"
                    >
                      <Icon name="map-point-wave-linear" size={15} />
                      Route
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("Calling community coordinator")}
                      className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2.5 rounded-xl bg-ng-paper border border-ng-line text-ng-ink cursor-pointer hover:border-ng-leaf transition-colors active:scale-[0.98]"
                    >
                      <Icon name="phone-linear" size={15} />
                      Call
                    </button>
                    {p.status === "handed_over" ? (
                      <span className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2.5 rounded-xl bg-ng-sage/40 text-ng-forest font-bold">
                        <Icon name="check-circle-bold" size={15} />
                        Done
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => advance(p.id)}
                        disabled={advancing === p.id}
                        className="inline-flex items-center justify-center gap-1.5 text-[12px] py-2.5 rounded-xl bg-ng-forest text-ng-cream font-bold cursor-pointer hover:bg-ng-forest-deep transition-colors active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-ng-forest"
                      >
                        <Icon name={p.status === "due" ? "box-bold" : "hand-stars-bold"} size={15} />
                        {p.status === "due" ? "Collect" : "Hand over"}
                      </button>
                    )}
                  </div>
                </CaptainCard>
              </div>
            );
          })}

          {loading && visible.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-ng-ink-soft">Loading your route…</p>
          ) : null}

          {!loading && visible.length === 0 ? (
            <CaptainEmpty
              icon="check-circle-bold"
              title={filter === "Due" ? "All caught up" : "Nothing here"}
              hint="No pickups match this filter."
            />
          ) : null}
        </div>
      </div>
    </CaptainShell>
  );
}
