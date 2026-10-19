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
import { cn } from "@/lib/utils";
import {
  useCaptain,
  formatCaptainDate,
  formatInr,
  submitSettlement,
  type CaptainSettlementView,
} from "@/components/ng/captain/captain-store";
import { UiIcon } from "@/components/ui/ui-icon";

/** Parse a typed rupee amount ("1,250.5") to integer paise, or null when it isn't one. */
function parseRupeesToPaise(raw: string): number | null {
  const clean = raw.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export default function CaptainSettle() {
  const { stats, todayCustomers, pendingCount, signedOut, syncNow } = useCaptain();
  const [submitting, setSubmitting] = useState(false);
  // The server-computed settlement (variance + commission), in rupees.
  const [result, setResult] = useState<CaptainSettlementView | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Captain confirms the physical cash they actually hold. Until they edit it,
  // the field tracks the expected figure (which settles as the day's stats
  // hydrate); any edit surfaces a variance the captain must own. Kept as text
  // so the field can be cleared and typed with paise.
  const [countedInput, setCountedInput] = useState<string | null>(null);
  const expectedCashPaise = Math.round(stats.cash * 100);
  const countedText = countedInput ?? String(stats.cash);
  const countedPaise = parseRupeesToPaise(countedText);
  const countValid = countedPaise !== null;
  // All in paise, so a balanced day never shows a 0.0000001 variance.
  const variancePaise = (countedPaise ?? 0) - expectedCashPaise;
  const matched = countValid && variancePaise === 0;
  const reconciledTotal = ((countedPaise ?? 0) + Math.round(stats.upi * 100)) / 100;

  const avgTicket = stats.count > 0 ? Math.round(stats.gmv / stats.count) : 0;
  const submitted = result !== null;

  async function submit() {
    if (stats.count === 0 || submitting || submitted || !countValid) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      // The server only counts sales it has received. Send any still waiting on
      // this phone first; settling without them would understate the day.
      const waiting = pendingCount > 0 ? await syncNow() : 0;
      if (waiting > 0) {
        setSubmitError(
          signedOut
            ? `Sign in again first. ${waiting} sale${waiting === 1 ? " has" : "s have"} not been sent yet.`
            : `${waiting} sale${waiting === 1 ? " has" : "s have"} not been sent yet. Connect to the internet, then submit.`,
        );
        return;
      }
      // The server recomputes expected GMV/cash/UPI, variance and commission
      // from today's captures — the client can't game them.
      const settlement = await submitSettlement((countedPaise ?? 0) / 100);
      setResult(settlement);
      toast.success("Settlement sent to the office", {
        description: `${formatInr(settlement.cashCounted + settlement.upiExpected)} from ${stats.count} customer${stats.count === 1 ? "" : "s"}`,
      });
    } catch {
      setSubmitError("The settlement was not sent. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const today = formatCaptainDate();

  return (
    <CaptainShell
      eyebrow={`End of day, ${today}`}
      title="Settle up"
      subtitle="Count your cash, check it against today's sales, then send it to the office."
    >
      {/* ===== Reconciled total ===== */}
      <CaptainHero className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ng-cream/75">Cash counted plus UPI</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
              matched ? "bg-ng-leaf/20 text-ng-leaf" : "bg-ng-amber/25 text-ng-amber",
            )}
          >
            <Icon name={matched ? "verified" : "danger-triangle-bold"} size={13} />
            {matched ? "Balanced" : "Does not match"}
          </span>
        </div>
        <div className="font-display text-[44px] text-ng-cream leading-none mt-2.5 tabular-nums">
          {formatInr(reconciledTotal)}
        </div>
        <div className="text-[13px] text-ng-cream/75 mt-2.5 tabular-nums">
          {stats.count} customer{stats.count === 1 ? "" : "s"} today
        </div>
      </CaptainHero>

      {/* ===== Day summary ===== */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <CaptainStat icon="banknote-2-bold" label="Cash sales" value={formatInr(stats.cash)} />
        <CaptainStat icon="smartphone-2-bold" label="UPI sales" value={formatInr(stats.upi)} />
        <CaptainStat icon="tag-price-bold" label="Average sale" value={formatInr(avgTicket)} />
      </div>

      {/* ===== Cash count / variance ===== */}
      <CaptainSectionHead>Count your cash</CaptainSectionHead>
      <CaptainCard className="space-y-3">
        <Row label="Total sales" value={formatInr(stats.gmv)} />
        <Row label="UPI, already received" value={formatInr(stats.upi)} muted />
        <Row label="Cash you should have" value={formatInr(stats.cash)} />
        <div className="pt-1">
          <label htmlFor="cash-counted" className="block text-[14px] font-medium text-ng-ink">
            Cash in hand
          </label>
          <div
            className={cn(
              "mt-1.5 flex min-h-14 items-center gap-2 w-full rounded-xl bg-ng-white border px-3.5 focus-within:ring-2 focus-within:ring-ng-leaf/50",
              countValid ? "border-ng-line focus-within:border-ng-forest" : "border-ng-danger",
            )}
          >
            <span className="text-[20px] text-ng-ink-muted" aria-hidden>
              ₹
            </span>
            <input
              id="cash-counted"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={countedText}
              disabled={submitted}
              aria-invalid={!countValid}
              aria-describedby="cash-counted-status"
              onChange={(e) => setCountedInput(e.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none font-display text-[24px] tabular-nums text-ng-forest-deep disabled:opacity-60"
            />
            {!submitted && countedInput !== null && variancePaise !== 0 ? (
              <button
                type="button"
                onClick={() => setCountedInput(null)}
                className="min-h-11 shrink-0 rounded-full bg-ng-sage/50 px-3.5 text-[13px] font-semibold text-ng-forest cursor-pointer hover:bg-ng-sage transition-colors"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
        <p
          id="cash-counted-status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px]",
            !countValid
              ? "bg-ng-danger/10 text-ng-danger"
              : matched
                ? "bg-ng-leaf/15 text-ng-forest-deep"
                : "bg-ng-amber/15 text-ng-soil",
          )}
        >
          <Icon name={matched ? "verified" : "danger-triangle-bold"} size={16} className="shrink-0" />
          {!countValid
            ? "Enter the amount in rupees, for example 1250 or 1250.50."
            : matched
              ? "Your cash matches today's cash sales."
              : `You have ${formatInr(Math.abs(variancePaise) / 100)} ${variancePaise > 0 ? "more" : "less"} than expected. Count again before you submit.`}
        </p>
      </CaptainCard>

      {/* ===== Submit ===== */}
      <div className="mt-5">
        {submitted && result ? (
          <CaptainHero className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-ng-cream flex items-center justify-center shrink-0">
                <UiIcon name="verified" size={26} className="text-ng-leaf" />
              </div>
              <div>
                <div className="font-display text-[17px]">Settlement sent</div>
                <div className="text-[13px] text-ng-cream/75 mt-0.5 tabular-nums">
                  {formatInr(result.cashCounted + result.upiExpected)} received by the office
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-ng-cream/15 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12px] text-ng-cream/75">Your commission</div>
                <div className="font-display text-[20px] text-ng-cream leading-none mt-1 tabular-nums">
                  {formatInr(result.commission)}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-ng-cream/75">Cash difference</div>
                <div className="font-display text-[20px] text-ng-cream leading-none mt-1 tabular-nums">
                  {result.variance > 0 ? "+" : ""}
                  {formatInr(result.variance)}
                </div>
              </div>
            </div>
          </CaptainHero>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={stats.count === 0 || submitting || !countValid}
            className="w-full flex min-h-14 items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold text-[16px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="arrow-right-up-linear" size={19} />
            {submitting ? "Sending…" : "Send settlement"}
          </button>
        )}
        {submitError ? (
          <p role="alert" className="mt-2 text-[14px] font-medium text-ng-danger text-center text-pretty">
            {submitError}
          </p>
        ) : stats.count === 0 && !submitted ? (
          <p className="text-[13px] text-ng-ink-muted text-center mt-2">
            Record at least one sale before you settle.
          </p>
        ) : pendingCount > 0 && !submitted ? (
          <p className="text-[13px] text-ng-ink-muted text-center mt-2 tabular-nums">
            {pendingCount} sale{pendingCount === 1 ? " is" : "s are"} waiting to send. They go first when you submit.
          </p>
        ) : null}
      </div>

      {/* ===== Customer ledger ===== */}
      <CaptainSectionHead
        action={<span className="text-[13px] text-ng-ink-muted tabular-nums">{todayCustomers.length} sales</span>}
      >
        Today&apos;s sales
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainEmpty
          icon="bill-list-bold"
          title="No sales to settle yet"
          hint="Sales you record today are listed here."
        />
      ) : (
        <CaptainCard className="!p-0 overflow-hidden">
          <ul className="divide-y divide-ng-line-soft">
            {todayCustomers.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] text-ng-forest-deep truncate">{c.name}</div>
                  <div className="text-[13px] text-ng-ink-muted tabular-nums mt-0.5">+91 {c.mobile}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-[16px] text-ng-forest-deep tabular-nums">{formatInr(c.total)}</div>
                  <span className={cn("text-[12px] font-semibold", c.payMode === "UPI" ? "text-ng-forest" : "text-ng-soil")}>
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
    <div className="flex items-center justify-between text-[14px]">
      <span className="text-ng-ink-muted">{label}</span>
      <span className={cn("tabular-nums", muted ? "text-ng-ink-muted" : "font-semibold text-ng-forest-deep")}>{value}</span>
    </div>
  );
}
