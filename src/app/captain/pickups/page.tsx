"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CaptainShell,
  CaptainCard,
  CaptainHero,
  CaptainStat,
  CaptainEmpty,
  CaptainStatusChip,
} from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  fetchCaptainPickups,
  advanceCaptainPickup,
  formatPickupWhen,
  PickupUpdateError,
} from "@/components/ng/captain/captain-store";
import type { CaptainPickup, CaptainPickupStatus } from "@/types/nutrigreenz";
import { UiIcon } from "@/components/ui/ui-icon";

/** The natural forward transition, mirroring the server's `nextPickupStatus`. */
const NEXT: Record<CaptainPickupStatus, CaptainPickupStatus | null> = {
  due: "collected",
  collected: "handed_over",
  handed_over: null,
};

/** The button for the next step, named for what it does. */
const NEXT_LABEL: Record<CaptainPickupStatus, string> = {
  due: "Mark collected",
  collected: "Mark handed over",
  handed_over: "",
};

/** A real directions link (the old Navigate and Route buttons only showed a toast). */
function mapsHref(p: CaptainPickup): string {
  const q = [p.address, p.community].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

type Filter = "All" | "Due" | "Done";

export default function CaptainPickups() {
  const [pickups, setPickups] = useState<CaptainPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const [advancing, setAdvancing] = useState<string | null>(null);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    setLoading(true);
    setFailed(false);
    const list = await fetchCaptainPickups();
    if (!alive()) return;
    if (list) setPickups(list);
    else setFailed(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void load(() => alive);
    return () => {
      alive = false;
    };
  }, [load]);

  async function advance(id: string) {
    const current = pickups.find((p) => p.id === id);
    if (!current || advancing) return;
    const next = NEXT[current.status];
    if (!next) return;

    setAdvancing(id);
    // Optimistic advance…
    setPickups((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
    try {
      const updated = await advanceCaptainPickup(id, next);
      setPickups((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success(
        next === "collected" ? `${current.community}: collected` : `${current.community}: handed over`,
      );
    } catch (err) {
      // The server holds a different status (changed elsewhere): show its row.
      if (err instanceof PickupUpdateError && err.pickup) {
        const serverRow = err.pickup;
        setPickups((prev) => prev.map((p) => (p.id === id ? serverRow : p)));
        toast.error("This pickup was already updated", {
          description: "The list now shows its current status.",
        });
      } else {
        // …revert on failure.
        setPickups((prev) => prev.map((p) => (p.id === id ? current : p)));
        toast.error("Pickup not updated", { description: "Check your connection and try again." });
      }
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
      eyebrow="Community bundles"
      title="Pickups"
      subtitle={
        loading && pickups.length === 0
          ? "Loading your route"
          : `${dueCount} due out of ${pickups.length} on your route today`
      }
    >
      {/* Route summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <CaptainStat label="Due" value={dueCount} icon="order" />
        <CaptainStat label="Collected" value={collectedCount} icon="bag-check-bold" />
        <CaptainStat label="Handed over" value={doneCount} icon="verified" />
      </div>

      {/* Next stop: the one main action on this screen */}
      {nextStop && filter !== "Done" ? (
        <CaptainHero className="p-5 mb-5">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-semibold text-ng-leaf">Next stop</span>
            <span className="text-ng-cream/75 tabular-nums">{formatPickupWhen(nextStop.dueAt)}</span>
          </div>
          <div className="font-display text-[22px] text-ng-cream mt-2 leading-tight text-balance">{nextStop.community}</div>
          <div className="text-[14px] text-ng-cream/75 mt-1">{nextStop.address ?? "Community pickup"}</div>
          <div className="mt-4 flex items-center gap-2.5">
            <a
              href={mapsHref(nextStop)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full ring-1 ring-ng-cream/30 text-ng-cream px-4 text-[14px] font-semibold"
            >
              <UiIcon name="location" size={16} />
              Directions
            </a>
            <button
              type="button"
              onClick={() => void advance(nextStop.id)}
              disabled={advancing === nextStop.id}
              className="flex-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold text-[15px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-50"
            >
              {advancing === nextStop.id ? "Saving…" : "Mark collected"}
            </button>
          </div>
        </CaptainHero>
      ) : null}

      {/* Filter */}
      <div role="tablist" aria-label="Filter pickups" className="flex gap-2 mb-4">
        {(["All", "Due", "Done"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-11 px-4 rounded-full text-[14px] font-semibold cursor-pointer transition-colors tabular-nums",
              filter === f
                ? "bg-ng-forest text-ng-cream"
                : "bg-ng-white border border-ng-line text-ng-ink-muted hover:border-ng-leaf",
            )}
          >
            {f}
            {f === "Due" && dueCount > 0 ? ` (${dueCount})` : ""}
            {f === "Done" && collectedCount + doneCount > 0 ? ` (${collectedCount + doneCount})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((p) => {
          const next = NEXT[p.status];
          return (
            <CaptainCard key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[16px] text-ng-forest-deep leading-snug">{p.community}</div>
                  <div className="text-[14px] text-ng-ink-muted mt-0.5">{p.address ?? "Community pickup"}</div>
                  <div className="flex items-center gap-1.5 text-[13px] text-ng-ink-muted mt-1.5 tabular-nums">
                    <UiIcon name="deliveryTime" size={14} />
                    {formatPickupWhen(p.dueAt)}
                  </div>
                </div>
                <CaptainStatusChip status={p.status} />
              </div>

              <div className="mt-3.5 pt-3 border-t border-ng-line-soft flex gap-2">
                <a
                  href={mapsHref(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Directions to ${p.community}`}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-ng-line bg-ng-paper px-4 text-[14px] text-ng-ink"
                >
                  <UiIcon name="location" size={16} />
                  Directions
                </a>
                {next ? (
                  <button
                    type="button"
                    onClick={() => void advance(p.id)}
                    disabled={advancing === p.id}
                    className="flex-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-ng-forest text-ng-cream text-[14px] font-semibold cursor-pointer hover:bg-ng-forest-deep transition-colors disabled:opacity-50"
                  >
                    <Icon name={p.status === "due" ? "order" : "hand-stars-bold"} size={16} />
                    {advancing === p.id ? "Saving…" : NEXT_LABEL[p.status]}
                  </button>
                ) : (
                  <span className="flex-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-ng-sage/40 text-ng-forest-deep text-[14px] font-semibold">
                    <UiIcon name="verified" size={16} />
                    Complete
                  </span>
                )}
              </div>
            </CaptainCard>
          );
        })}

        {loading && pickups.length === 0 ? (
          <div aria-busy="true" aria-label="Loading your route" className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-[150px] rounded-2xl border border-ng-line bg-ng-white motion-safe:animate-pulse" />
            ))}
          </div>
        ) : null}

        {!loading && failed ? (
          <CaptainEmpty
            icon="danger-triangle-bold"
            title="Your pickups did not load"
            hint="Check your connection and try again."
            action={
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ng-forest px-5 text-[14px] font-semibold text-ng-cream cursor-pointer"
              >
                <Icon name="refresh-bold" size={16} />
                Try again
              </button>
            }
          />
        ) : null}

        {!loading && !failed && visible.length === 0 ? (
          <CaptainEmpty
            icon="verified"
            title={pickups.length === 0 ? "No pickups today" : filter === "Due" ? "Nothing left to collect" : "Nothing here yet"}
            hint={pickups.length === 0 ? "New pickups show up here when the office assigns them." : "No pickups match this filter."}
          />
        ) : null}
      </div>
    </CaptainShell>
  );
}
