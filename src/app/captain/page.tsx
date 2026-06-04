"use client";

import Link from "next/link";
import { CaptainShell, CaptainCard, CaptainSectionHead } from "@/components/ng/captain/captain-shell";
import { Icon } from "@/components/ui/icon";
import { useCaptain, formatCaptainDate } from "@/components/ng/captain/captain-store";

/** Community pickups due today — demo data (managed on the Pickups tab). */
const PICKUPS_DUE = [
  { community: "My Home Avatar", slot: "Today · 5–7 PM", orders: 12 },
  { community: "Aparna Sarovar Zenith", slot: "Today · 6–8 PM", orders: 8 },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function CaptainHome() {
  const { captain, stats, todayCustomers } = useCaptain();
  const today = formatCaptainDate();

  return (
    <CaptainShell
      eyebrow={today}
      title={
        <>
          {greeting()}, {captain.name.split(" ")[0]}.
        </>
      }
      subtitle={
        <>
          You&apos;re stationed at <span className="text-ng-forest font-medium">{captain.stall}</span>.
        </>
      }
    >
      {/* Hero — today's stall capture */}
      <CaptainCard tone="forest" className="relative overflow-hidden">
        <div className="absolute -top-12 -right-10 size-40 rounded-full bg-ng-leaf/20 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ng-leaf-soft">
            <Icon name="bag-smile-bold" size={15} />
            Captured today
          </div>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-display text-[48px] text-ng-cream leading-none">{stats.count}</span>
            <span className="text-[13px] text-ng-cream/70 pb-1.5">stall customers</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <MiniStat label="Stall GMV" value={`₹${stats.gmv.toLocaleString("en-IN")}`} />
            <MiniStat label="Orders" value={String(stats.orders)} />
          </div>
          <Link
            href="/captain/intake"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-semibold py-3 text-[14px] hover:bg-ng-green-bright transition-colors"
          >
            <Icon name="user-plus-bold" size={18} />
            Capture a customer
          </Link>
        </div>
      </CaptainCard>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <QuickAction href="/captain/intake" icon="user-plus-bold" label="Intake" tone="forest" />
        <QuickAction href="/captain/pickups" icon="box-bold" label="Pickups" />
        <QuickAction href="/captain/settle" icon="wallet-money-bold" label="Settle" />
      </div>

      {/* Pickups due */}
      <CaptainSectionHead
        action={
          <Link href="/captain/pickups" className="text-[12px] text-ng-forest font-medium inline-flex items-center gap-1">
            All <Icon name="arrow-right-linear" size={14} />
          </Link>
        }
      >
        Pickups due today
      </CaptainSectionHead>
      <div className="space-y-2.5">
        {PICKUPS_DUE.map((p) => (
          <Link key={p.community} href="/captain/pickups" className="block">
            <CaptainCard className="flex items-center gap-3 hover:border-ng-leaf transition-colors">
              <div className="size-10 rounded-xl bg-ng-sage/60 flex items-center justify-center shrink-0">
                <Icon name="box-bold" size={20} className="text-ng-forest" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[14px] text-ng-forest-deep truncate">{p.community}</div>
                <div className="text-[12px] text-ng-ink-muted mt-0.5">{p.slot}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-[18px] text-ng-forest-deep leading-none">{p.orders}</div>
                <div className="text-[10px] uppercase tracking-wider text-ng-ink-soft mt-1">orders</div>
              </div>
            </CaptainCard>
          </Link>
        ))}
      </div>

      {/* Recent captures */}
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
        <CaptainCard tone="sage" className="text-center py-7">
          <Icon name="users-group-rounded-linear" size={30} className="text-ng-forest mx-auto" />
          <p className="text-[13px] text-ng-forest-deep mt-2 font-medium">No captures yet today</p>
          <p className="text-[12px] text-ng-ink-muted mt-1 max-w-[16rem] mx-auto">
            Tap “Capture a customer” to log your first stall sale.
          </p>
        </CaptainCard>
      ) : (
        <div className="space-y-2.5">
          {todayCustomers.slice(0, 3).map((c) => (
            <CaptainCard key={c.id} className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-ng-clay/25 text-ng-clay-deep flex items-center justify-center font-display text-[13px] shrink-0">
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ng-forest-soft/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ng-leaf-soft">{label}</div>
      <div className="font-display text-[18px] text-ng-cream leading-none mt-1">{value}</div>
    </div>
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
          ? "flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-ng-forest text-ng-cream py-3.5 text-[12.5px] font-semibold hover:bg-ng-forest-deep transition-colors"
          : "flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-ng-white border border-ng-line text-ng-forest-deep py-3.5 text-[12.5px] font-medium hover:border-ng-leaf transition-colors"
      }
    >
      <Icon name={icon} size={22} className={tone === "forest" ? "text-ng-leaf" : "text-ng-forest"} />
      {label}
    </Link>
  );
}
