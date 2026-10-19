"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CaptainShell,
  CaptainCard,
  CaptainHero,
  CaptainSectionHead,
  CaptainRing,
  CaptainStat,
  CaptainEmpty,
  CaptainStatusChip,
} from "@/components/ng/captain/captain-shell";
import {
  useCaptain,
  formatCaptainDate,
  formatInr,
  formatPickupWhen,
  fetchCaptainPickups,
} from "@/components/ng/captain/captain-store";
import type { CaptainPickup } from "@/types/nutrigreenz";
import { UiIcon } from "@/components/ui/ui-icon";

/** Captain's daily target: customers served, tracked by the ring on Today. */
const DAILY_GOAL = 15;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function CaptainHome() {
  const { captain, stats, todayCustomers } = useCaptain();
  const today = formatCaptainDate();
  const remaining = Math.max(0, DAILY_GOAL - stats.count);

  // Community pickups still due today (managed on the Pickups tab).
  const [duePickups, setDuePickups] = useState<CaptainPickup[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchCaptainPickups();
      if (!cancelled && list) setDuePickups(list.filter((p) => p.status === "due"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const nextStop = duePickups[0];

  const firstName = captain?.name?.trim() ? captain.name.split(" ")[0] : "";

  return (
    <CaptainShell
      eyebrow={today}
      title={
        <>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </>
      }
      subtitle={captain?.stall ? `Your stall today: ${captain.stall}` : undefined}
    >
      {/* ===== Today's figures + the one main action ===== */}
      <CaptainHero className="p-5">
        <div className="flex items-center gap-4">
          <CaptainRing value={stats.count} max={DAILY_GOAL} size={88} stroke={8}>
            <span className="font-display text-[30px] text-ng-cream leading-none tabular-nums">{stats.count}</span>
            <span className="text-[11px] text-ng-cream/70 mt-0.5">of {DAILY_GOAL}</span>
          </CaptainRing>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-ng-cream/75">Sales today</div>
            <div className="font-display text-[34px] leading-none mt-1 tabular-nums">{formatInr(stats.gmv)}</div>
            <div className="text-[13px] text-ng-cream/75 mt-2 text-pretty">
              {remaining > 0
                ? `${remaining} more customer${remaining === 1 ? "" : "s"} to reach today's goal.`
                : "You have reached today's goal."}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <CaptainStat tone="onForest" icon="banknote-2-bold" label="Cash" value={formatInr(stats.cash)} />
          <CaptainStat tone="onForest" icon="smartphone-2-bold" label="UPI" value={formatInr(stats.upi)} />
        </div>

        <Link
          href="/captain/intake"
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold text-[16px] cursor-pointer hover:bg-ng-green-bright transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-cream"
        >
          <UiIcon name="customers" size={18} />
          Record a sale
        </Link>
      </CaptainHero>

      {/* ===== Next pickup ===== */}
      {nextStop ? (
        <>
          <CaptainSectionHead
            action={
              <Link
                href="/captain/pickups"
                className="inline-flex min-h-11 items-center text-[14px] text-ng-forest font-semibold cursor-pointer"
              >
                All pickups
              </Link>
            }
          >
            Next pickup
          </CaptainSectionHead>
          <div className="space-y-2.5">
            {duePickups.slice(0, 3).map((p) => (
              <Link key={p.id} href="/captain/pickups" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest">
                <CaptainCard className="flex min-h-16 items-center gap-3 cursor-pointer hover:border-ng-leaf transition-colors">
                  <div className="size-11 rounded-xl bg-ng-sage/50 flex items-center justify-center shrink-0">
                    <UiIcon name="ordersBox" size={20} className="text-ng-forest" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[15px] text-ng-forest-deep truncate">{p.community}</div>
                    <div className="text-[13px] text-ng-ink-muted mt-0.5 tabular-nums">{formatPickupWhen(p.dueAt)}</div>
                  </div>
                  <CaptainStatusChip status={p.status} />
                </CaptainCard>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {/* ===== Latest sales ===== */}
      <CaptainSectionHead
        action={
          todayCustomers.length > 0 ? (
            <span className="text-[13px] text-ng-ink-muted tabular-nums">{todayCustomers.length} today</span>
          ) : undefined
        }
      >
        Latest sales
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainEmpty
          icon="customers"
          title="No sales yet today"
          hint="Your sales show here as soon as you record them."
          action={
            <Link
              href="/captain/intake"
              className="inline-flex min-h-11 items-center rounded-full bg-ng-forest px-5 text-[14px] font-semibold text-ng-cream"
            >
              Record a sale
            </Link>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {todayCustomers.slice(0, 3).map((c) => (
            <CaptainCard key={c.id} className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-ng-sage/60 text-ng-forest flex items-center justify-center font-display text-[15px] shrink-0" aria-hidden>
                {c.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[15px] text-ng-forest-deep truncate">{c.name}</div>
                <div className="text-[13px] text-ng-ink-muted mt-0.5 tabular-nums">+91 {c.mobile}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-[17px] text-ng-forest-deep tabular-nums">{formatInr(c.total)}</div>
                <div className="text-[12px] text-ng-ink-muted mt-0.5">{c.payMode}</div>
              </div>
            </CaptainCard>
          ))}
        </div>
      )}
    </CaptainShell>
  );
}
