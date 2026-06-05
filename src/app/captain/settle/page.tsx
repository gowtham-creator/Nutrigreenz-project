"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CaptainShell, CaptainCard, CaptainSectionHead } from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import { useCaptain, formatCaptainDate } from "@/components/ng/captain/captain-store";

export default function CaptainSettle() {
  const { stats, todayCustomers, captain } = useCaptain();
  const [submitted, setSubmitted] = useState(false);

  // Captain confirms the physical cash they actually hold. Pre-filled to the
  // expected figure; any edit surfaces a variance the captain must own.
  const [cashCounted, setCashCounted] = useState<number>(stats.cash);
  const cashVariance = cashCounted - stats.cash;
  const expectedTotal = stats.gmv;
  const reconciledTotal = cashCounted + stats.upi;
  const matched = cashVariance === 0;

  // Read-only day summary derived from store stats (no store changes).
  const avgTicket = stats.count > 0 ? Math.round(stats.gmv / stats.count) : 0;
  const cashShare = stats.gmv > 0 ? Math.round((stats.cash / stats.gmv) * 100) : 0;
  const upiShare = stats.gmv > 0 ? 100 - cashShare : 0;

  function submit() {
    setSubmitted(true);
    toast.success("Settlement submitted to HQ", {
      description: `₹${reconciledTotal.toLocaleString("en-IN")} across ${stats.count} customers · ${captain.area}`,
    });
  }

  const today = formatCaptainDate();

  return (
    <CaptainShell
      eyebrow={`End of day · ${today}`}
      title="Settle up"
      subtitle="Reconcile your stall takings, then submit to HQ."
    >
      {/* ===== Reconciled hero ===== */}
      <CaptainCard tone="forest" className="relative overflow-hidden !p-5">
        <div className="absolute -top-12 -right-10 size-40 rounded-full bg-ng-clay/25 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ng-leaf-soft">
              <Icon name="wallet-money-bold" size={15} />
              Reconciled today
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                matched ? "bg-ng-leaf/20 text-ng-leaf" : "bg-ng-amber/20 text-ng-amber"
              }`}
            >
              <Icon name={matched ? "check-circle-bold" : "danger-triangle-bold"} size={12} />
              {matched ? "Balanced" : "Variance"}
            </span>
          </div>
          <div className="font-display text-[44px] text-ng-cream leading-none mt-2.5">
            ₹{reconciledTotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[12px] text-ng-cream/70 mt-2.5">
            {stats.count} customers · {stats.orders} orders captured
          </div>

          {/* payment mix bar */}
          {stats.gmv > 0 ? (
            <div className="mt-4">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ng-cream/12">
                <div
                  className="h-full bg-ng-clay motion-safe:transition-[width] motion-safe:duration-700"
                  style={{ width: `${cashShare}%` }}
                />
                <div
                  className="h-full bg-ng-leaf motion-safe:transition-[width] motion-safe:duration-700"
                  style={{ width: `${upiShare}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px] text-ng-cream/65">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-ng-clay" aria-hidden /> Cash {cashShare}%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  UPI {upiShare}% <span className="size-2 rounded-full bg-ng-leaf" aria-hidden />
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </CaptainCard>

      {/* ===== Day summary ===== */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <DayStat icon="users-group-rounded-bold" label="Customers" value={String(stats.count)} />
        <DayStat icon="bag-smile-bold" label="Stall GMV" value={`₹${stats.gmv.toLocaleString("en-IN")}`} />
        <DayStat icon="tag-price-bold" label="Avg ticket" value={`₹${avgTicket.toLocaleString("en-IN")}`} />
      </div>

      {/* ===== Per-mode breakdown ===== */}
      <CaptainSectionHead>Collected by mode</CaptainSectionHead>
      <div className="grid grid-cols-2 gap-3">
        <CaptainCard className="h-full">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-ng-clay/15 flex items-center justify-center">
              <Icon name="banknote-2-bold" size={18} className="text-ng-clay-deep" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Cash</span>
          </div>
          <div className="font-display text-[22px] text-ng-forest-deep mt-2.5">
            ₹{stats.cash.toLocaleString("en-IN")}
          </div>
        </CaptainCard>
        <CaptainCard className="h-full">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-ng-leaf/15 flex items-center justify-center">
              <Icon name="smartphone-2-bold" size={18} className="text-ng-forest" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-ng-ink-soft">UPI</span>
          </div>
          <div className="font-display text-[22px] text-ng-forest-deep mt-2.5">
            ₹{stats.upi.toLocaleString("en-IN")}
          </div>
        </CaptainCard>
      </div>

      {/* ===== Cash count / variance ===== */}
      <CaptainSectionHead>Cash reconciliation</CaptainSectionHead>
      <CaptainCard className="space-y-3">
        <Row label="Expected (captured)" value={`₹${expectedTotal.toLocaleString("en-IN")}`} />
        <Row label="UPI (auto-verified)" value={`₹${stats.upi.toLocaleString("en-IN")}`} muted />
        <label className="block pt-1">
          <span className="text-[12.5px] font-medium text-ng-ink-muted">Cash in hand (counted)</span>
          <div className="mt-1.5 flex items-center gap-2 w-full rounded-xl bg-ng-white border border-ng-line px-3.5 py-3 focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all">
            <span className="text-[16px] text-ng-ink-soft">₹</span>
            <input
              type="number"
              min={0}
              value={cashCounted}
              disabled={submitted}
              onChange={(e) => setCashCounted(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-transparent outline-none font-display text-[19px] text-ng-forest-deep disabled:opacity-60"
            />
            {!submitted && cashVariance !== 0 ? (
              <button
                type="button"
                onClick={() => setCashCounted(stats.cash)}
                className="text-[11px] font-semibold text-ng-forest rounded-full bg-ng-sage/50 px-2.5 py-1 cursor-pointer hover:bg-ng-sage transition-colors"
              >
                Reset
              </button>
            ) : null}
          </div>
        </label>
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] ${
            matched ? "bg-ng-leaf/15 text-ng-forest" : "bg-ng-amber/15 text-ng-clay-deep"
          }`}
        >
          <Icon name={matched ? "check-circle-bold" : "danger-triangle-bold"} size={16} className="shrink-0" />
          {matched
            ? "Cash matches captured total."
            : `Variance ${cashVariance > 0 ? "+" : ""}₹${cashVariance.toLocaleString("en-IN")} — note it before submitting.`}
        </div>
      </CaptainCard>

      {/* ===== Submit ===== */}
      <div className="mt-5">
        {submitted ? (
          <div className="relative overflow-hidden rounded-2xl bg-ng-forest-deep text-ng-cream p-4 flex items-center gap-3">
            <div className="absolute -top-10 -right-8 size-28 rounded-full bg-ng-leaf/15 blur-2xl" aria-hidden />
            <div className="relative size-11 rounded-full bg-ng-leaf/20 flex items-center justify-center shrink-0">
              <Icon name="check-circle-bold" size={26} className="text-ng-leaf" />
            </div>
            <div className="relative">
              <div className="font-display text-[15px]">Settlement submitted</div>
              <div className="text-[12px] text-ng-cream/70 mt-0.5">
                ₹{reconciledTotal.toLocaleString("en-IN")} reconciled · synced to HQ
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={stats.count === 0}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold py-4 text-[15px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-45 disabled:hover:bg-ng-leaf active:scale-[0.99] shadow-[0_12px_28px_-10px_rgba(102,191,115,0.75)]"
          >
            <Icon name="square-arrow-right-up-bold" size={19} />
            Submit settlement to HQ
          </button>
        )}
        {stats.count === 0 && !submitted ? (
          <p className="text-[11.5px] text-ng-ink-soft text-center mt-2">
            Capture at least one customer before settling.
          </p>
        ) : null}
      </div>

      {/* ===== Customer ledger ===== */}
      <CaptainSectionHead
        action={<span className="text-[12px] text-ng-ink-soft">{todayCustomers.length} entries</span>}
      >
        Today&apos;s ledger
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainCard tone="sage" className="text-center py-6 text-[13px] text-ng-ink-muted">
          Captured sales will be listed here for reconciliation.
        </CaptainCard>
      ) : (
        <CaptainCard className="!p-0 overflow-hidden">
          <ul className="divide-y divide-ng-line-soft">
            {todayCustomers.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 ${c.payMode === "UPI" ? "bg-ng-leaf" : "bg-ng-clay"}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-[13.5px] text-ng-forest-deep truncate">{c.name}</div>
                    <div className="text-[11px] text-ng-ink-soft font-mono mt-0.5">+91 {c.mobile}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-[15px] text-ng-forest-deep">
                    ₹{c.total.toLocaleString("en-IN")}
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold ${
                      c.payMode === "UPI" ? "text-ng-forest" : "text-ng-clay-deep"
                    }`}
                  >
                    {c.payMode}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CaptainCard>
      )}
    </CaptainShell>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ng-ink-muted">{label}</span>
      <span className={muted ? "text-ng-ink-muted" : "font-medium text-ng-forest-deep"}>{value}</span>
    </div>
  );
}

function DayStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ng-white border border-ng-line px-3 py-3 shadow-[0_1px_3px_rgba(10,31,18,0.04)]">
      <Icon name={icon} size={17} className="text-ng-forest" />
      <div className="font-display text-[17px] text-ng-forest-deep leading-none mt-2 truncate">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft mt-1">{label}</div>
    </div>
  );
}
