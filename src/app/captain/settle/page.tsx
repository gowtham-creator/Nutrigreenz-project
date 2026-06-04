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

  function submit() {
    setSubmitted(true);
    toast.success("Settlement submitted to HQ", {
      description: `₹${reconciledTotal.toLocaleString("en-IN")} across ${stats.count} customers · ${captain.area}`,
    });
  }

  const today = formatCaptainDate();

  return (
    <CaptainShell eyebrow={`End of day · ${today}`} title="Settle up" subtitle="Reconcile your stall takings, then submit to HQ.">
      {/* Hero — reconciled total */}
      <CaptainCard tone="forest" className="relative overflow-hidden">
        <div className="absolute -top-12 -right-10 size-40 rounded-full bg-ng-clay/25 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ng-leaf-soft">
            <Icon name="wallet-money-bold" size={15} />
            Reconciled today
          </div>
          <div className="font-display text-[44px] text-ng-cream leading-none mt-2">
            ₹{reconciledTotal.toLocaleString("en-IN")}
          </div>
          <div className="text-[12px] text-ng-cream/70 mt-2.5">
            {stats.count} customers · {stats.orders} orders captured
          </div>
        </div>
      </CaptainCard>

      {/* Per-mode breakdown */}
      <CaptainSectionHead>Collected by mode</CaptainSectionHead>
      <div className="grid grid-cols-2 gap-3">
        <CaptainCard className="text-center">
          <Icon name="banknote-2-bold" size={22} className="text-ng-clay-deep mx-auto" />
          <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mt-2">Cash</div>
          <div className="font-display text-[22px] text-ng-forest-deep mt-0.5">
            ₹{stats.cash.toLocaleString("en-IN")}
          </div>
        </CaptainCard>
        <CaptainCard className="text-center">
          <Icon name="smartphone-2-bold" size={22} className="text-ng-forest mx-auto" />
          <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mt-2">UPI</div>
          <div className="font-display text-[22px] text-ng-forest-deep mt-0.5">
            ₹{stats.upi.toLocaleString("en-IN")}
          </div>
        </CaptainCard>
      </div>

      {/* Cash count / variance */}
      <CaptainSectionHead>Cash reconciliation</CaptainSectionHead>
      <CaptainCard className="space-y-3">
        <Row label="Expected (captured)" value={`₹${expectedTotal.toLocaleString("en-IN")}`} />
        <Row label="UPI (auto-verified)" value={`₹${stats.upi.toLocaleString("en-IN")}`} muted />
        <label className="block pt-1">
          <span className="text-[12.5px] font-medium text-ng-ink-muted">Cash in hand (counted)</span>
          <div className="mt-1.5 flex items-center gap-2 w-full rounded-xl bg-ng-white border border-ng-line px-3.5 py-2.5 focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all">
            <span className="text-[15px] text-ng-ink-soft">₹</span>
            <input
              type="number"
              min={0}
              value={cashCounted}
              disabled={submitted}
              onChange={(e) => setCashCounted(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-transparent outline-none font-display text-[18px] text-ng-forest-deep disabled:opacity-60"
            />
          </div>
        </label>
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] ${
            cashVariance === 0
              ? "bg-ng-leaf/15 text-ng-forest"
              : "bg-ng-amber/15 text-ng-clay-deep"
          }`}
        >
          <Icon name={cashVariance === 0 ? "check-circle-bold" : "danger-triangle-bold"} size={16} />
          {cashVariance === 0
            ? "Cash matches captured total."
            : `Variance ${cashVariance > 0 ? "+" : ""}₹${cashVariance.toLocaleString("en-IN")} — note it before submitting.`}
        </div>
      </CaptainCard>

      {/* Submit */}
      <div className="mt-5">
        {submitted ? (
          <div className="rounded-2xl bg-ng-forest-deep text-ng-cream p-4 flex items-center gap-3">
            <div className="size-10 rounded-full bg-ng-leaf/20 flex items-center justify-center shrink-0">
              <Icon name="check-circle-bold" size={24} className="text-ng-leaf" />
            </div>
            <div>
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
            className="w-full flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-semibold py-3.5 text-[15px] hover:bg-ng-green-bright transition-colors disabled:opacity-45 disabled:hover:bg-ng-leaf"
          >
            <Icon name="square-arrow-right-up-bold" size={19} />
            Submit settlement
          </button>
        )}
        {stats.count === 0 && !submitted ? (
          <p className="text-[11.5px] text-ng-ink-soft text-center mt-2">
            Capture at least one customer before settling.
          </p>
        ) : null}
      </div>

      {/* Customer ledger */}
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
                <div className="min-w-0">
                  <div className="font-medium text-[13.5px] text-ng-forest-deep truncate">{c.name}</div>
                  <div className="text-[11px] text-ng-ink-soft font-mono mt-0.5">+91 {c.mobile}</div>
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
