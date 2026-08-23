"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { useAuth } from "@/lib/auth";
import { fetchRewards } from "@/lib/rewards-client";
import {
  fetchMyOrders,
  formatOrderDate,
  inrFromPaise,
  orderItemCount,
  orderProductTitles,
  statusLabel,
  statusTone,
  type OrderView,
} from "@/lib/orders-client";

export default function AccountPage() {
  const { account, isAuthed, loading: authLoading } = useAuth();
  const firstName = isAuthed ? account?.name?.trim()?.split(" ")[0] || "there" : "there";

  /* The dashboard used to read `listReceipts()` — receipts the checkout wrote to
     this browser's storage. That made every figure here local and stale: the
     count was whatever this device happened to have placed, the status was
     frozen at "processing" forever, and signing in on a phone showed no orders
     at all. It now reads the same server source as /account/orders, so the
     numbers on this page and that one can never disagree. */
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [creditRupees, setCreditRupees] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthed) return;
    const controller = new AbortController();
    fetchMyOrders(controller.signal)
      .then(setOrders)
      .catch(() => {
        /* The orders card degrades to its empty state — no invented rows. */
      });
    return () => controller.abort();
  }, [authLoading, isAuthed]);

  // Wallet credit was hardcoded "₹0". Read the live points balance and the live
  // points-per-rupee rate instead, so the tile agrees with /loyalty.
  useEffect(() => {
    if (authLoading || !isAuthed) return;
    let cancelled = false;
    void (async () => {
      const [rewards, perRupee] = await Promise.all([
        fetchRewards(),
        fetch("/api/loyalty-config", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { config?: { pointsPerRupee?: number } } | null) =>
            Math.max(1, Math.round(j?.config?.pointsPerRupee ?? 1)),
          )
          .catch(() => 1),
      ]);
      if (!cancelled) setCreditRupees(Math.floor(rewards.balance / perRupee));
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthed]);

  const recent = orders.slice(0, 3);
  const stats = [
    {
      icon: "wallet-money-bold",
      number: creditRupees === null ? "—" : `₹${creditRupees.toLocaleString("en-IN")}`,
      label: "Wallet credit",
      href: "/loyalty",
      tint: "leaf" as const,
    },
    {
      icon: "box-bold",
      number: String(orders.length),
      label: "Orders placed",
      href: "/account/orders",
      tint: "leaf" as const,
    },
    { icon: "refresh-bold", number: "0", label: "Subscriptions", href: undefined, tint: "blue" as const },
  ];

  return (
    <AccountShell active="overview">
      <div className="space-y-10">
        {/* Hero card */}
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep p-8 text-ng-cream shadow-[var(--shadow-ng-float)] ring-1 ring-ng-leaf/15 md:p-10">
            <div aria-hidden className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-ng-leaf/25 blur-3xl" />
            <div aria-hidden className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-ng-forest-soft/45 blur-3xl" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, transparent, transparent 22px, rgba(255,255,255,0.5) 22px, rgba(255,255,255,0.5) 23px)",
              }}
            />
            <div className="relative">
              <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-leaf">
                <Icon name="leaf-bold" size={14} />
                Welcome back, {firstName}
              </span>
              <h1 className="mt-2.5 max-w-xl font-display text-[clamp(32px,4vw,46px)] leading-[1.05]">
                Your harvest, <em className="italic text-ng-leaf">at a glance.</em>
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ng-cream/70">
                Track deliveries, manage subscriptions and watch your wallet grow. All in one place.
              </p>

              <Stagger className="mt-8 grid max-w-xl grid-cols-3 items-stretch gap-3 md:gap-4">
                {stats.map((s) => {
                  const tint = s.tint === "leaf" ? "text-ng-leaf" : "text-ng-blue";
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
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
                <Icon name="box-bold" size={16} />
              </span>
              <h2 className="font-display text-[26px] leading-none text-ng-forest-deep">Recent orders</h2>
            </div>
            {recent.length > 0 ? (
              <Link href="/account/orders" className="inline-flex items-center gap-1 text-[13px] font-medium text-ng-forest hover:underline">
                View all <Icon name="alt-arrow-right-linear" size={14} />
              </Link>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-10 text-center">
              <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-ng-paper text-ng-forest shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
                <Icon name="box-linear" size={26} />
              </span>
              <p className="font-display text-[19px] text-ng-forest-deep">No orders yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-ng-ink-muted">
                Your first harvest is one tap away. Fresh oils, ghee, honey and more.
              </p>
              <Button variant="primary" className="mt-5" asChild>
                <Link href="/shop">Start shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recent.map((o) => {
                const tone = statusTone(o.status);
                const titles = orderProductTitles(o);
                const count = orderItemCount(o);
                return (
                  <article
                    key={o.orderNumber}
                    className="ng-float flex flex-col gap-4 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-display text-[17px] leading-none text-ng-forest-deep">
                          {o.orderNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider ${tone.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {statusLabel(o.status)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12px] text-ng-ink-soft">
                        {formatOrderDate(o.placedAt)} · {count} item{count === 1 ? "" : "s"}
                      </div>
                      <p className="mt-2 line-clamp-1 text-[13px] text-ng-ink-muted">
                        {titles.join(", ")}
                      </p>
                    </div>

                    {/* The amount is pinned to its natural width with its own
                        line-height. Without that it was being squeezed by the
                        row on a narrow screen and the digits collided. */}
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-5">
                      <span className="shrink-0 whitespace-nowrap font-display text-[19px] leading-tight tabular-nums text-ng-forest-deep">
                        {inrFromPaise(o.totalPaise)}
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/account/orders/${o.orderNumber}`}
                          className="min-h-[40px] whitespace-nowrap"
                        >
                          Details →
                        </Link>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Reveal>

        {/* Subscriptions */}
        <Reveal as="section">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
              <Icon name="refresh-bold" size={16} />
            </span>
            <h2 className="font-display text-[26px] leading-none text-ng-forest-deep">Active subscriptions</h2>
          </div>
          <div className="rounded-3xl border border-dashed border-ng-line bg-ng-sage/20 p-8 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-ng-paper text-ng-forest shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
              <Icon name="refresh-linear" size={22} />
            </span>
            <p className="font-display text-[18px] text-ng-forest-deep">No active subscriptions</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-ng-ink-muted">
              Subscribe to your staples and never run out. Set it once and we deliver on schedule.
            </p>
          </div>
        </Reveal>

        {/* Review prompt — only once there are orders to review */}
        {orders.length > 0 ? (
          <Reveal as="section">
            <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-ng-leaf/25 bg-gradient-to-br from-ng-sage/40 to-ng-cream p-7 md:flex-row md:items-center">
              <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ng-leaf/15 blur-3xl" />
              <div className="relative flex-1">
                <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-forest">
                  <Icon name="wallet-money-bold" size={14} />
                  Earn ₹100
                </span>
                <h3 className="mt-2 font-display text-[22px] text-ng-forest-deep">Review your recent orders</h3>
                <p className="mt-2 max-w-md text-[14px] text-ng-ink-muted">
                  Honest reviews help future buyers. We credit ₹100 to your wallet for every verified review you publish.
                </p>
              </div>
              <div className="relative flex items-center gap-4">
                <Button variant="primary" asChild>
                  <Link href="/account/orders">Write a review</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        ) : null}
      </div>
    </AccountShell>
  );
}
