"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CaptainShell,
  CaptainCard,
  CaptainHero,
  CaptainSectionHead,
  CaptainStat,
  CaptainEmpty,
} from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import {
  useCaptain,
  formatCaptainDate,
  submitSettlement,
  type CaptainSettlementView,
} from "@/components/ng/captain/captain-store";
import { UiIcon } from "@/components/ui/ui-icon";

export default function CaptainSettle() {
  const { stats, todayCustomers, captain } = useCaptain();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The server-computed settlement (variance + commission), in rupees.
  const [result, setResult] = useState<CaptainSettlementView | null>(null);

  // Captain confirms the physical cash they actually hold. Until they edit it,
  // the field tracks the expected figure (which settles as the day's stats
  // hydrate); any edit surfaces a variance the captain must own.
  const [countedInput, setCountedInput] = useState<number | null>(null);
  const cashCounted = countedInput ?? stats.cash;
  const cashVariance = cashCounted - stats.cash;
  const expectedTotal = stats.gmv;
  const reconciledTotal = cashCounted + stats.upi;
  const matched = cashVariance === 0;

  // Read-only day summary derived from store stats (no store changes).
  const avgTicket = stats.count > 0 ? Math.round(stats.gmv / stats.count) : 0;
  const cashShare = stats.gmv > 0 ? Math.round((stats.cash / stats.gmv) * 100) : 0;
  const upiShare = stats.gmv > 0 ? 100 - cashShare : 0;

  async function submit() {
    if (stats.count === 0 || submitting || submitted) return;
    setSubmitting(true);
    try {
      // The server recomputes expected GMV/cash/UPI, variance and commission
      // from today's captures — the client can't game them.
      const settlement = await submitSettlement(cashCounted);
      setResult(settlement);
      setSubmitted(true);
      toast.success("Settlement submitted to HQ", {
        description: `₹${(settlement.cashCounted + settlement.upiExpected).toLocaleString("en-IN")} across ${stats.count} customers · ${captain?.area ?? "your area"}`,
      });
    } catch {
      toast.error("Couldn't submit settlement", {
        description: "Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const today = formatCaptainDate();

  return (
    <CaptainShell
      eyebrow={`End of day · ${today}`}
      title="Settle up"
      subtitle="Reconcile your stall takings, then submit to HQ."
    >
      {/* ===== Reconciled hero ===== */}
      <CaptainHero className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ng-leaf-soft">
            <UiIcon name="wallet" size={15} />
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
                className="h-full bg-ng-cream-deep motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${cashShare}%` }}
              />
              <div
                className="h-full bg-ng-leaf motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${upiShare}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-ng-cream/65">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-ng-cream-deep" aria-hidden /> Cash {cashShare}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                UPI {upiShare}% <span className="size-2 rounded-full bg-ng-leaf" aria-hidden />
              </span>
            </div>
          </div>
        ) : null}
      </CaptainHero>

      {/* ===== Day summary ===== */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <CaptainStat icon="customers" label="Customers" value={stats.count} />
        <CaptainStat icon="bag-smile-bold" label="Stall GMV" value={`₹${stats.gmv.toLocaleString("en-IN")}`} />
        <CaptainStat icon="tag-price-bold" label="Avg ticket" value={`₹${avgTicket.toLocaleString("en-IN")}`} />
      </div>

      {/* ===== Per-mode breakdown ===== */}
      <CaptainSectionHead>Collected by mode</CaptainSectionHead>
      <div className="grid grid-cols-2 gap-3">
        <CaptainCard className="h-full">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-ng-cream flex items-center justify-center">
              <UiIcon name="wallet" size={18} className="text-ng-soil" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Cash</span>
          </div>
          <div className="font-display text-[22px] text-ng-forest-deep mt-2.5">
            ₹{stats.cash.toLocaleString("en-IN")}
          </div>
        </CaptainCard>
        <CaptainCard className="h-full">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-ng-cream flex items-center justify-center">
              <Icon name="smartphone-bold" size={18} className="text-ng-forest" />
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
              onChange={(e) => setCountedInput(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-transparent outline-none font-display text-[19px] text-ng-forest-deep disabled:opacity-60"
            />
            {!submitted && cashVariance !== 0 ? (
              <button
                type="button"
                onClick={() => setCountedInput(stats.cash)}
                className="text-[11px] font-semibold text-ng-forest rounded-full bg-ng-sage/50 px-2.5 py-1 cursor-pointer hover:bg-ng-sage transition-colors"
              >
                Reset
              </button>
            ) : null}
          </div>
        </label>
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] ${
            matched ? "bg-ng-leaf/15 text-ng-forest" : "bg-ng-amber/15 text-ng-soil"
          }`}
        >
          <Icon name={matched ? "check-circle-bold" : "danger-triangle-bold"} size={16} className="shrink-0" />
          {matched
            ? "Cash matches captured total."
            : `Variance ${cashVariance > 0 ? "+" : ""}₹${cashVariance.toLocaleString("en-IN")}. Note it before submitting.`}
        </div>
      </CaptainCard>

      {/* ===== Submit ===== */}
      <div className="mt-5">
        {submitted ? (
          <CaptainHero className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-ng-cream flex items-center justify-center shrink-0">
                <UiIcon name="verified" size={26} className="text-ng-leaf" />
              </div>
              <div>
                <div className="font-display text-[15px]">Settlement submitted</div>
                <div className="text-[12px] text-ng-cream/70 mt-0.5">
                  ₹{reconciledTotal.toLocaleString("en-IN")} reconciled · synced to HQ
                </div>
              </div>
            </div>
            {result ? (
              <div className="mt-3 pt-3 border-t border-ng-cream/12 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ng-leaf-soft">Commission</div>
                  <div className="font-display text-[18px] text-ng-cream leading-none mt-1">
                    ₹{result.commission.toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ng-leaf-soft">Cash variance</div>
                  <div className="font-display text-[18px] text-ng-cream leading-none mt-1">
                    {result.variance > 0 ? "+" : ""}₹{result.variance.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ) : null}
          </CaptainHero>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={stats.count === 0 || submitting}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold py-4 text-[15px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-45 disabled:hover:bg-ng-leaf active:scale-[0.99] shadow-[0_12px_28px_-10px_rgba(102,191,115,0.75)]"
          >
            <Icon name="arrow-right-up-linear" size={19} />
            {submitting ? "Submitting…" : "Submit settlement to HQ"}
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
        <CaptainEmpty
          icon="bill-list-bold"
          title="No sales to reconcile yet"
          hint="Captured sales will be listed here for end-of-day reconciliation."
        />
      ) : (
        <CaptainCard className="!p-0 overflow-hidden">
          <ul className="divide-y divide-ng-line-soft">
            {todayCustomers.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 ${c.payMode === "UPI" ? "bg-ng-leaf" : "bg-ng-soil"}`}
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
                      c.payMode === "UPI" ? "text-ng-forest" : "text-ng-soil"
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

