"use client";

import Link from "next/link";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Stars } from "@/components/ng/stars";
import { Icon } from "@/components/ui/icon";
import { Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { useAuth } from "@/lib/auth";

const ORDERS = [
  { id: "NG-25-1042", date: "2026-05-12", total: 2640, items: 3, status: "out for delivery", lot: "NG-24-051", products: ["Cold-Pressed Groundnut Oil — 1L", "A2 Gir Cow Ghee — 500ml", "Multifloral Raw Honey — 500g"] },
  { id: "NG-25-0981", date: "2026-04-28", total: 1430, items: 2, status: "delivered", lot: "NG-24-018", products: ["A2 Desi Cow Ghee — 1L Jar", "Foxtail Millet — 500g"] },
  { id: "NG-25-0863", date: "2026-04-14", total: 3960, items: 1, status: "delivered", lot: "NG-24-039", products: ["Harvest Hamper — Festive Edition"] },
];

// One unified pill system — every status is a soft tint + matching dot, so no
// single status reads as a heavier/odd "solid" chip against the others.
const STATUS: Record<string, { dot: string; pill: string }> = {
  "out for delivery": { dot: "bg-ng-amber", pill: "bg-ng-amber/15 text-ng-clay-deep" },
  delivered: { dot: "bg-ng-green-bright", pill: "bg-ng-leaf/15 text-ng-forest" },
  processing: { dot: "bg-ng-blue", pill: "bg-ng-blue/12 text-ng-blue" },
};

const STATS = [
  { icon: "wallet-money-bold", number: "₹1,420", label: "Wallet credit", href: "/loyalty", tint: "clay" },
  { icon: "box-bold", number: "14", label: "Orders placed", href: "/orders", tint: "leaf" },
  { icon: "refresh-bold", number: "3", label: "Subscriptions", href: undefined, tint: "blue" },
] as const;

export default function AccountPage() {
  const { account, isAuthed } = useAuth();
  const firstName = isAuthed ? (account?.name?.trim()?.split(" ")[0] || "there") : "there";

  return (
    <AccountShell active="overview">
      <div className="space-y-10">
        {/* Hero card */}
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep p-8 text-ng-cream shadow-[var(--shadow-ng-float)] ring-1 ring-ng-clay/20 md:p-10">
            <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-ng-clay/30 blur-3xl" />
            <div aria-hidden className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-ng-leaf/20 blur-3xl" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, transparent, transparent 22px, rgba(255,255,255,0.5) 22px, rgba(255,255,255,0.5) 23px)",
              }}
            />
            <div className="relative">
              <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-clay">
                <Icon name="leaf-bold" size={14} />
                Welcome back, {firstName}
              </span>
              <h1 className="mt-2.5 max-w-xl font-display text-[clamp(32px,4vw,46px)] leading-[1.05]">
                Your harvest, <em className="italic text-ng-clay">at a glance.</em>
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ng-cream/70">
                Track deliveries, manage subscriptions and watch your wallet grow — all in one place.
              </p>

              <Stagger className="mt-8 grid max-w-xl grid-cols-3 items-stretch gap-3 md:gap-4">
                {STATS.map((s) => {
                  const tint =
                    s.tint === "clay"
                      ? "text-ng-clay"
                      : s.tint === "leaf"
                        ? "text-ng-leaf"
                        : "text-ng-blue";
                  const inner = (
                    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ng-cream/12 bg-ng-cream/[0.06] p-4 backdrop-blur-sm transition-colors hover:bg-ng-cream/[0.1]">
                      <Icon name={s.icon} size={20} className={`${tint} opacity-90`} />
                      <div className="mt-3 font-display text-[clamp(22px,2.4vw,30px)] leading-none text-ng-cream tabular-nums">
                        {s.number}
                      </div>
                      <div className="mt-1.5 text-[11px] uppercase tracking-wider text-ng-cream/55">
                        {s.label}
                      </div>
                      {s.href ? (
                        <Icon
                          name="alt-arrow-right-linear"
                          size={14}
                          className="absolute right-3.5 top-3.5 text-ng-cream/40 transition-transform group-hover:translate-x-0.5"
                        />
                      ) : null}
                    </div>
                  );
                  return (
                    <StaggerItem key={s.label} className="h-full">
                      {s.href ? <Link href={s.href} className="block h-full">{inner}</Link> : inner}
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </div>
          </div>
        </Reveal>

        {/* Recent orders */}
        <Reveal as="section">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-sage/60 text-ng-forest-deep">
                <Icon name="box-bold" size={16} />
              </span>
              <h2 className="font-display text-[26px] leading-none text-ng-forest-deep">Recent orders</h2>
            </div>
            <Link href="/orders" className="inline-flex items-center gap-1 text-[13px] font-medium text-ng-forest hover:underline">
              View all <Icon name="alt-arrow-right-linear" size={14} />
            </Link>
          </div>
          <div className="space-y-4">
            {ORDERS.map((o) => {
              const tone = STATUS[o.status] ?? STATUS.processing;
              const extra = o.items - o.products.length;
              return (
                <article
                  key={o.id}
                  className="ng-float flex flex-col gap-4 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
                >
                  {/* Left — id + status, meta, products */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-display text-[17px] leading-none text-ng-forest-deep">{o.id}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {o.status}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ng-ink-soft">
                      <span>
                        {new Date(o.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {o.items} item{o.items > 1 ? "s" : ""}
                      </span>
                      <span aria-hidden className="text-ng-line">•</span>
                      <span className="font-mono">lot {o.lot}</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-[13px] text-ng-ink-muted">
                      {o.products.join(", ")}
                      {extra > 0 ? ` +${extra} more` : ""}
                    </p>
                  </div>

                  {/* Right — total + details */}
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end sm:gap-5">
                    <span className="font-display text-[19px] tabular-nums text-ng-forest-deep">₹{o.total.toLocaleString("en-IN")}</span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/orders/${o.id}`}>Details →</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </Reveal>

        {/* Subscriptions */}
        <Reveal as="section">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-sage/60 text-ng-forest-deep">
              <Icon name="refresh-bold" size={16} />
            </span>
            <h2 className="font-display text-[26px] leading-none text-ng-forest-deep">Active subscriptions</h2>
          </div>
          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {[
              { name: "A2 Gir Cow Ghee — 500ml", next: "12 June", cadence: "6 weeks", price: "₹1,480" },
              { name: "Cold-Pressed Groundnut Oil — 1L", next: "22 May", cadence: "4 weeks", price: "₹645" },
              { name: "Multifloral Raw Honey — 500g", next: "08 July", cadence: "8 weeks", price: "₹540" },
            ].map((s) => (
              <article key={s.name} className="ng-float group flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="line-clamp-2 font-display text-[15px] leading-tight text-ng-forest-deep">{s.name}</div>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest transition-colors group-hover:bg-ng-leaf/20">
                    <Icon name="refresh-linear" size={15} />
                  </span>
                </div>
                <div className="mt-1.5 text-[12px] text-ng-ink-muted">Every {s.cadence} · {s.price}</div>
                <div className="mt-auto flex items-center justify-between border-t border-ng-line-soft pt-4 text-[12px]">
                  <span className="text-ng-ink-soft">Next: <span className="font-medium text-ng-forest-deep">{s.next}</span></span>
                  <button className="font-medium text-ng-forest hover:underline">Manage</button>
                </div>
              </article>
            ))}
          </div>
        </Reveal>

        {/* Review prompt */}
        <Reveal as="section">
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-ng-clay/30 bg-gradient-to-br from-ng-sage/40 to-ng-cream p-7 md:flex-row md:items-center">
            <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ng-clay/15 blur-3xl" />
            <div className="relative flex-1">
              <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-clay-deep">
                <Icon name="wallet-money-bold" size={14} />
                Earn ₹100
              </span>
              <h3 className="mt-2 font-display text-[22px] text-ng-forest-deep">Review your last 3 orders</h3>
              <p className="mt-2 max-w-md text-[14px] text-ng-ink-muted">
                Honest reviews help future buyers. We credit ₹100 to your wallet for every verified review you publish.
              </p>
            </div>
            <div className="relative flex items-center gap-4">
              <Stars rating={5} size="md" />
              <Button variant="primary">Write a review</Button>
            </div>
          </div>
        </Reveal>
      </div>
    </AccountShell>
  );
}
