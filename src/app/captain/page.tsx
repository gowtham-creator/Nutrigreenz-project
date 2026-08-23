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
} from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import {
  useCaptain,
  formatCaptainDate,
  formatPickupWhen,
  fetchCaptainPickups,
} from "@/components/ng/captain/captain-store";
import type { CaptainPickup } from "@/types/nutrigreenz";
import { UiIcon } from "@/components/ui/ui-icon";

/** Captain's daily capture target — the "mission" the dashboard tracks toward. */
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
  const goalPct = Math.min(100, Math.round((stats.count / DAILY_GOAL) * 100));

  // Real community pickups due today (managed on the Pickups tab).
  const [duePickups, setDuePickups] = useState<CaptainPickup[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchCaptainPickups();
      if (!cancelled) setDuePickups(list.filter((p) => p.status === "due"));
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
          {firstName ? `, ${firstName}` : ""}.
        </>
      }
      subtitle={
        <>
          Your stall is live at{" "}
          <span className="text-ng-forest font-semibold">{captain?.stall ?? "your community stall"}</span>. Let&apos;s
          capture the day.
        </>
      }
    >
      {/* ===== Mission hero ===== */}
      <CaptainHero className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-ng-leaf/15 ring-1 ring-ng-leaf/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ng-leaf">
            <UiIcon name="target" size={12} />
            Daily mission
          </div>
          <span className="text-[11px] text-ng-cream/55">Goal · {DAILY_GOAL}</span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <CaptainRing value={stats.count} max={DAILY_GOAL} size={96} stroke={9} className="text-ng-cream">
            <span className="font-display text-[30px] text-ng-cream leading-none">{stats.count}</span>
            <span className="text-[9px] uppercase tracking-[0.12em] text-ng-leaf-soft mt-0.5">captured</span>
          </CaptainRing>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-ng-cream/80 leading-snug">
              {remaining > 0 ? (
                <>
                  <span className="font-display text-ng-cream text-[18px]">{remaining} more</span> to hit today&apos;s
                  target.
                </>
              ) : (
                <span className="font-display text-ng-cream text-[16px]">Target smashed — keep going.</span>
              )}
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-ng-cream/12 overflow-hidden">
              <div
                className="h-full rounded-full bg-ng-leaf motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <div className="mt-1.5 text-[10.5px] text-ng-cream/55">{goalPct}% of daily goal</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <CaptainStat
            tone="onForest"
            icon="bag-smile-bold"
            label="Stall GMV"
            value={`₹${stats.gmv.toLocaleString("en-IN")}`}
          />
          <CaptainStat tone="onForest" icon="checklist-minimalistic-bold" label="Orders" value={stats.orders} />
        </div>

        <Link
          href="/captain/intake"
          className="group mt-4 flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold py-3.5 text-[14.5px] cursor-pointer hover:bg-ng-green-bright transition-colors shadow-[0_10px_24px_-8px_rgba(102,191,115,0.7)]"
        >
          <UiIcon name="customers" size={18} />
          Capture a customer
          <Icon
            name="arrow-right-linear"
            size={17}
            className="motion-safe:transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </CaptainHero>

      {/* ===== Quick actions ===== */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <QuickAction href="/captain/intake" icon="user-plus-bold" label="Intake" tone="forest" />
        <QuickAction href="/captain/pickups" icon="box-bold" label="Pickups" />
        <QuickAction href="/captain/settle" icon="wallet-money-bold" label="Settle" />
      </div>

      {/* ===== Next stop (route emphasis) ===== */}
      {nextStop ? (
        <>
          <CaptainSectionHead
            action={
              <Link
                href="/captain/pickups"
                className="text-[12px] text-ng-forest font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                All pickups <Icon name="arrow-right-linear" size={14} />
              </Link>
            }
          >
            Next stop
          </CaptainSectionHead>
          <Link href="/captain/pickups" className="block">
            <div className="relative overflow-hidden rounded-2xl border border-ng-leaf/40 bg-ng-sage/30 p-4 cursor-pointer hover:border-ng-leaf transition-colors">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-ng-forest ring-1 ring-ng-leaf/30 flex items-center justify-center shrink-0">
                  <UiIcon name="location" size={22} className="text-ng-leaf" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ng-forest">Up next</span>
                  </div>
                  <div className="font-display text-[15px] text-ng-forest-deep truncate leading-tight mt-0.5">
                    {nextStop.community}
                  </div>
                  <div className="text-[12px] text-ng-ink-muted mt-0.5">{formatPickupWhen(nextStop.dueAt)}</div>
                </div>
                <div className="shrink-0 text-ng-forest">
                  <Icon name="arrow-right-linear" size={20} />
                </div>
              </div>
            </div>
          </Link>

          {duePickups.slice(1).length > 0 ? (
            <div className="space-y-2.5 mt-2.5">
              {duePickups.slice(1).map((p) => (
                <Link key={p.id} href="/captain/pickups" className="block">
                  <CaptainCard className="flex items-center gap-3 cursor-pointer hover:border-ng-leaf transition-colors">
                    <div className="size-10 rounded-xl bg-ng-cream flex items-center justify-center shrink-0">
                      <UiIcon name="ordersBox" size={20} className="text-ng-forest" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[14px] text-ng-forest-deep truncate">{p.community}</div>
                      <div className="text-[12px] text-ng-ink-muted mt-0.5">{formatPickupWhen(p.dueAt)}</div>
                    </div>
                    <div className="shrink-0 text-ng-ink-soft">
                      <Icon name="arrow-right-linear" size={18} />
                    </div>
                  </CaptainCard>
                </Link>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {/* ===== Recent captures ===== */}
      <CaptainSectionHead
        action={
          todayCustomers.length > 0 ? (
            <span className="text-[12px] text-ng-ink-soft">{todayCustomers.length} today</span>
          ) : undefined
        }
      >
        Latest captures
      </CaptainSectionHead>
      {todayCustomers.length === 0 ? (
        <CaptainEmpty
          icon="customers"
          title="No captures yet today"
          hint="Tap “Capture a customer” to log your first stall sale."
        />
      ) : (
        <div className="space-y-2.5">
          {todayCustomers.slice(0, 3).map((c) => (
            <CaptainCard key={c.id} className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-ng-sage/60 text-ng-forest flex items-center justify-center font-display text-[13px] shrink-0">
                {c.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[13.5px] text-ng-forest-deep truncate">{c.name}</div>
                <div className="text-[11.5px] text-ng-ink-soft font-mono mt-0.5">+91 {c.mobile}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-[15px] text-ng-forest-deep">₹{c.total.toLocaleString("en-IN")}</div>
                <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft mt-0.5">{c.payMode}</div>
              </div>
            </CaptainCard>
          ))}
        </div>
      )}
    </CaptainShell>
  );
}

function QuickAction({
  href,
  icon,
  label,
  tone = "paper",
}: {
  href: string;
  icon: string;
  label: string;
  tone?: "paper" | "forest";
}) {
  return (
    <Link
      href={href}
      className={
        tone === "forest"
          ? "flex flex-col items-center justify-center gap-1.5 h-full rounded-2xl bg-ng-forest text-ng-cream py-3.5 text-[12.5px] font-bold cursor-pointer hover:bg-ng-forest-deep transition-colors shadow-[0_8px_20px_-10px_rgba(20,51,31,0.6)]"
          : "flex flex-col items-center justify-center gap-1.5 h-full rounded-2xl bg-ng-white border border-ng-line text-ng-forest-deep py-3.5 text-[12.5px] font-medium cursor-pointer hover:border-ng-leaf hover:bg-ng-sage/20 transition-colors"
      }
    >
      <Icon name={icon} size={22} className={tone === "forest" ? "text-ng-leaf" : "text-ng-forest"} />
      {label}
    </Link>
  );
}
