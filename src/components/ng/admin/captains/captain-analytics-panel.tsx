"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { DayBars } from "@/components/ng/admin/orders/order-summary-panel";
import { cn } from "@/lib/utils";
import { shortCommunity } from "@/lib/community-label";
import type { AnalyticsPeriod, CaptainAnalytics } from "@/lib/captain-analytics";

/**
 * Sales analytics for one captain, or everyone when `captainId` is omitted.
 *
 * Tap Today, Week, Month or Quarter, or pick any dates, and narrow to one
 * community. The sales list follows the same filters, so finding what a captain
 * sold on a given day no longer means scrolling through all their sales.
 */

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
];

function inr(paise: number): string {
  const p = Math.round(paise);
  return `₹${(p / 100).toLocaleString("en-IN", {
    minimumFractionDigits: p % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const FIELD =
  "h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-forest";

export function CaptainAnalyticsPanel({ captainId }: { captainId?: string }) {
  const [period, setPeriod] = useState<AnalyticsPeriod | "custom">("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [community, setCommunity] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data: CaptainAnalytics | null } | null>(null);
  const [shown, setShown] = useState<CaptainAnalytics | null>(null);

  const params = new URLSearchParams();
  if (captainId) params.set("captainId", captainId);
  if (community) params.set("community", community);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  const key = `${query}#${attempt}`;

  useEffect(() => {
    let alive = true;
    void fetch(`/api/admin/captains/analytics?${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { analytics?: CaptainAnalytics } | null) => {
        if (!alive) return;
        setResult({ key, data: j?.analytics ?? null });
        if (j?.analytics) setShown(j.analytics);
      })
      .catch(() => {
        if (alive) setResult({ key, data: null });
      });
    return () => {
      alive = false;
    };
  }, [query, key]);

  const loading = result?.key !== key;
  const failed = !loading && result?.data === null;
  const data = shown;

  function pickPeriod(p: AnalyticsPeriod) {
    if (!data) return;
    setPeriod(p);
    setFrom(data.periods[p].from);
    setTo(data.periods[p].to);
  }

  const rangeFrom = from || data?.range.from || "";
  const rangeTo = to || data?.range.to || "";

  return (
    <div className="space-y-5" aria-busy={loading}>
      {/* Period tiles double as the quick date filter. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PERIODS.map((p) => {
          const f = data?.periods[p.key];
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => pickPeriod(p.key)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors cursor-pointer",
                period === p.key
                  ? "border-ng-leaf bg-ng-sage/30 ring-1 ring-ng-leaf/50"
                  : "border-ng-line-soft bg-ng-paper hover:border-ng-leaf",
              )}
            >
              <div className="text-[13px] font-semibold text-ng-ink-muted">{p.label}</div>
              <div className="mt-1.5 font-display text-[26px] leading-none tabular-nums text-ng-forest-deep">
                {f ? inr(f.gmvPaise) : "…"}
              </div>
              <div className="mt-1.5 text-[13px] text-ng-ink-muted">
                {f ? `${f.sales.toLocaleString("en-IN")} sale${f.sales === 1 ? "" : "s"}` : " "}
              </div>
            </button>
          );
        })}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <label className="text-[13px] font-semibold text-ng-ink-muted">
          From
          <input
            type="date"
            value={rangeFrom}
            max={rangeTo || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setTo(rangeTo);
              setPeriod("custom");
            }}
            className={`${FIELD} mt-1`}
          />
        </label>
        <label className="text-[13px] font-semibold text-ng-ink-muted">
          To
          <input
            type="date"
            value={rangeTo}
            min={rangeFrom || undefined}
            onChange={(e) => {
              setFrom(rangeFrom);
              setTo(e.target.value);
              setPeriod("custom");
            }}
            className={`${FIELD} mt-1`}
          />
        </label>
      </div>

      {/* Communities */}
      {data && data.communities.length > 0 ? (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ng-ink-muted">Communities</div>
          <div className="flex flex-wrap gap-2">
            {["", ...data.communities].map((c) => (
              <button
                key={c || "all"}
                type="button"
                title={c || undefined}
                aria-pressed={community === c}
                onClick={() => setCommunity(c)}
                className={cn(
                  "min-h-10 max-w-[280px] truncate rounded-full border px-4 text-[14px] font-semibold transition-colors cursor-pointer",
                  community === c
                    ? "border-ng-forest bg-ng-forest text-ng-cream"
                    : "border-ng-line bg-ng-paper text-ng-ink hover:border-ng-leaf",
                )}
              >
                {c ? shortCommunity(c) : "All"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="rounded-2xl border border-ng-danger/40 bg-ng-danger/5 p-4 text-[14px] text-ng-danger">
          Sales didn&rsquo;t load.{" "}
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline cursor-pointer">
            Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <p className="text-[15px] text-ng-ink">
            <strong className="font-semibold">{inr(data.range.gmvPaise)}</strong> from{" "}
            {data.range.sales.toLocaleString("en-IN")} sale{data.range.sales === 1 ? "" : "s"}
            <span className="text-ng-ink-muted">
              {" "}
              · Cash {inr(data.range.cashPaise)} · UPI {inr(data.range.upiPaise)}
            </span>
          </p>

          {data.range.sales > 0 ? (
            <div className="rounded-2xl border border-ng-line-soft bg-ng-paper p-4 overflow-x-auto">
              <div style={{ minWidth: Math.max(260, data.range.daily.length * 12) }}>
                <DayBars
                  noun="sale"
                  days={data.range.daily.map((d) => ({ day: d.day, orders: d.sales, bookedPaise: d.gmvPaise }))}
                />
              </div>
            </div>
          ) : null}

          <div className={cn("grid gap-4", !captainId && "lg:grid-cols-2")}>
            {!captainId ? (
              <Breakdown
                title="By captain"
                rows={data.byCaptain.map((c) => ({ key: c.captainId, label: c.name, sales: c.sales, gmvPaise: c.gmvPaise }))}
              />
            ) : null}
            <Breakdown
              title="By community"
              rows={data.byCommunity.map((c) => ({
                key: c.community,
                label: shortCommunity(c.community),
                sales: c.sales,
                gmvPaise: c.gmvPaise,
              }))}
            />
          </div>

          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold text-ng-forest-deep">
              <Icon name="cart-large-2-bold" size={17} className="text-ng-forest" />
              Sales in these dates
              {data.range.sales > data.sales.length ? (
                <span className="text-[13px] font-medium text-ng-ink-muted">
                  (latest {data.sales.length} of {data.range.sales})
                </span>
              ) : null}
            </h3>
            {data.sales.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ng-line-soft px-4 py-5 text-center text-[14px] text-ng-ink-muted">
                No sales in these dates.
              </p>
            ) : (
              <ul className="divide-y divide-ng-line-soft rounded-2xl border border-ng-line-soft bg-ng-paper">
                {data.sales.map((s) => (
                  <li key={s.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-ng-ink">
                            {s.customerName || "Walk-up customer"}
                          </span>
                          <Pill tone={s.payMode === "upi" ? "success" : "info"}>{s.payMode}</Pill>
                        </div>
                        <div className="mt-0.5 text-[13.5px] text-ng-ink-muted">
                          {when(s.capturedAt)}
                          {captainId ? "" : ` · ${s.captainName}`}
                          {s.community ? ` · ${shortCommunity(s.community)}` : ""}
                        </div>
                      </div>
                      <div className="font-display text-[19px] tabular-nums text-ng-forest-deep">{inr(s.totalPaise)}</div>
                    </div>
                    {s.items ? <div className="mt-1.5 text-[14px] text-ng-ink">{s.items}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : !failed ? (
        <div className="h-40 rounded-2xl bg-ng-line-soft/50 animate-pulse" />
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; sales: number; gmvPaise: number }[];
}) {
  const top = Math.max(1, ...rows.map((r) => r.gmvPaise));
  return (
    <section className="rounded-2xl border border-ng-line-soft bg-ng-paper p-4">
      <h3 className="mb-3 text-[15px] font-semibold text-ng-forest-deep">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[14px] text-ng-ink-muted">No sales in these dates.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate font-medium text-ng-ink">{r.label}</span>
                <span className="shrink-0 tabular-nums text-ng-ink-muted">
                  <strong className="font-semibold text-ng-ink">{inr(r.gmvPaise)}</strong> · {r.sales}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-ng-line-soft">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.gmvPaise / top) * 100}%`, background: "var(--ng-viz-stage-3)" }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
