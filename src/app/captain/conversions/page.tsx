"use client";

import { useCallback, useEffect, useState } from "react";
import { CaptainShell, CaptainCard, CaptainEmpty, CaptainStat } from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The captain's own conversions: the people they sold to at the stall, or who
 * were registered as theirs, who went on to buy online.
 *
 * It shows who converted and when, not what they spent online, and only the
 * last four digits of each mobile. The captain needs to see their work turn
 * into online customers; the customer's spending is the store's business.
 */

interface Row {
  name: string | null;
  mobileEnd: string;
  via: "sale" | "registered";
  firstTouchAt: string;
  status: "converted" | "already-online" | "not-yet";
  firstOnlineAt: string | null;
  onlineOrders: number;
}

interface Summary {
  offlineCustomers: number;
  converted: number;
  alreadyOnline: number;
  rate: number;
  onlineOrders: number;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default function CaptainConversions() {
  const [data, setData] = useState<{ summary: Summary | null; customers: Row[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"converted" | "not-yet">("converted");

  const load = useCallback(async (alive: () => boolean = () => true) => {
    setFailed(false);
    try {
      const res = await fetch("/api/captain/conversions", { cache: "no-store" });
      const json = res.ok ? ((await res.json()) as { summary: Summary | null; customers: Row[] }) : null;
      if (!alive()) return;
      if (json) setData(json);
      else setFailed(true);
    } catch {
      if (alive()) setFailed(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await load(() => alive);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const s = data?.summary;
  const rows = (data?.customers ?? []).filter((c) => c.status === tab);

  return (
    <CaptainShell
      eyebrow="Your customers"
      title="Conversions"
      subtitle={s ? `${s.converted} of your customers now buy online` : "Customers you brought who now buy online"}
    >
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <CaptainStat label="Converted" value={s ? s.converted : "…"} icon="graph-up-bold" tone="forest" />
        <CaptainStat label="Your customers" value={s ? s.offlineCustomers : "…"} icon="users-group-rounded-bold" />
        <CaptainStat label="Rate" value={s ? `${Math.round(s.rate * 100)}%` : "…"} icon="chart-2-bold" />
      </div>

      <div role="tablist" aria-label="Filter customers" className="flex gap-2 mb-4">
        {(
          [
            { key: "converted", label: "Converted" },
            { key: "not-yet", label: "Not yet online" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-11 px-4 rounded-full text-[14px] font-semibold cursor-pointer transition-colors",
              tab === t.key
                ? "bg-ng-forest text-ng-cream"
                : "bg-ng-white border border-ng-line text-ng-ink-muted hover:border-ng-leaf",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {failed ? (
        <CaptainEmpty
          icon="danger-triangle-bold"
          title="Your conversions did not load"
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
      ) : !data ? (
        <div aria-busy="true" className="h-40 rounded-2xl border border-ng-line bg-ng-white motion-safe:animate-pulse" />
      ) : rows.length === 0 ? (
        <CaptainEmpty
          icon="graph-up-bold"
          title={tab === "converted" ? "No conversions yet" : "Everyone you met is online"}
          hint={
            tab === "converted"
              ? "When someone you sold to buys from the online store, they appear here."
              : "All your customers have ordered online."
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <CaptainCard key={`${c.mobileEnd}-${c.firstTouchAt}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[16px] text-ng-forest-deep leading-snug">{c.name || "Customer"}</div>
                  <div className="text-[14px] text-ng-ink-muted mt-0.5 tabular-nums">Mobile ending {c.mobileEnd}</div>
                  <div className="text-[14px] text-ng-ink-muted mt-1">
                    {c.via === "sale" ? "Bought at your stall" : "Registered as yours"} on {day(c.firstTouchAt)}
                  </div>
                  {c.firstOnlineAt ? (
                    <div className="text-[14px] font-semibold text-ng-forest mt-1">
                      Ordered online on {day(c.firstOnlineAt)} · {c.onlineOrders} order{c.onlineOrders === 1 ? "" : "s"}
                    </div>
                  ) : null}
                </div>
                {c.status === "converted" ? (
                  <span className="shrink-0 rounded-full bg-ng-forest px-3 py-1 text-[12.5px] font-semibold text-ng-cream">
                    Converted
                  </span>
                ) : null}
              </div>
            </CaptainCard>
          ))}
        </div>
      )}
    </CaptainShell>
  );
}
