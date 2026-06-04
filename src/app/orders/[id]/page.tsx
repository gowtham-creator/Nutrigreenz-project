"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useMemo, useSyncExternalStore } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { NoCancellationNotice } from "@/components/ng/checkout/no-cancellation";
import {
  loadReceipt,
  type OrderReceipt,
} from "@/components/ng/checkout/order-receipt";
import { PRODUCTS } from "@/components/ng/data";
import { Reveal } from "@/components/ng/motion";

const TIMELINE: { label: string; time: string; icon: string; done: boolean; active?: boolean }[] = [
  { label: "Order placed", time: "12 May · 8:42 PM", icon: "cart-check-bold", done: true },
  { label: "Payment confirmed", time: "12 May · 8:42 PM", icon: "card-bold", done: true },
  { label: "Packed at warehouse", time: "13 May · 11:08 AM", icon: "box-bold", done: true },
  { label: "Picked up by carrier", time: "13 May · 4:30 PM", icon: "delivery-bold", done: true },
  { label: "Out for delivery", time: "14 May · 9:20 AM", icon: "scooter-bold", done: true, active: true },
  { label: "Delivered", time: "Expected today, by 7 PM", icon: "verified-check-bold", done: false },
];

// Mock line items (used when no live receipt is present for this id).
const MOCK_LINES = [
  { product: PRODUCTS.find((p) => p.id === "p-101")!, qty: 1, lot: "JUN-24-018" },
  { product: PRODUCTS.find((p) => p.id === "p-001")!, qty: 2, lot: "ANT-24-051" },
  { product: PRODUCTS.find((p) => p.id === "p-201")!, qty: 1, lot: "NIL-24-006" },
];

interface DetailLine {
  id: string;
  title: string;
  slug?: string;
  image: string;
  qty: number;
  lot: string;
  lineTotal: number;
}

const NOOP = () => () => {};

export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // SSR-safe receipt read (same pattern as the invoice + confirmation pages).
  const getSnapshot = useMemo(() => {
    const cached = loadReceipt(id);
    return () => cached;
  }, [id]);

  const stored = useSyncExternalStore<OrderReceipt | null>(
    NOOP,
    getSnapshot,
    () => null,
  );

  const lines: DetailLine[] = stored
    ? stored.items.map((i) => {
        const match = PRODUCTS.find((p) => p.id === i.productId);
        return {
          id: i.productId,
          title: i.title,
          slug: match?.slug,
          image: i.image || match?.image || "/images/placeholder.svg",
          qty: i.qty,
          lot: i.lotCode ?? "—",
          lineTotal: i.price * i.qty,
        };
      })
    : MOCK_LINES.map((l) => ({
        id: l.product.id,
        title: l.product.title,
        slug: l.product.slug,
        image: l.product.image,
        qty: l.qty,
        lot: l.lot,
        lineTotal: l.product.price * l.qty,
      }));

  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = stored?.subtotal ?? lines.reduce((s, l) => s + l.lineTotal, 0);
  const shipping = stored?.shipping ?? 0;
  const total = stored?.total ?? subtotal;
  const placedLabel = stored
    ? new Date(stored.placedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "12 May 2026";

  return (
    <AccountShell active="orders">
      <div className="space-y-7">
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-forest">
              <Icon name="box-bold" size={14} />
              Order · <span className="font-mono normal-case tracking-normal text-ng-forest-deep">{id}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-amber/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-ng-clay-deep">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ng-amber" />
              Out for delivery
            </span>
          </div>
          <h1 className="mt-2 font-display text-[clamp(28px,4vw,38px)] leading-tight text-ng-forest-deep">
            On its way to you.
          </h1>
          <span className="mt-1 block text-[13px] text-ng-ink-muted">
            Placed {placedLabel} · {itemCount} item{itemCount > 1 ? "s" : ""}
          </span>
        </header>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" size="sm" asChild>
            <Link href="/orders/track">
              <Icon name="map-arrow-square-bold" size={16} />
              Track order
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${id}/invoice`}>
              <Icon name="document-text-bold" size={16} />
              Invoice
            </Link>
          </Button>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-7">
            {/* Map placeholder */}
            <Reveal className="relative aspect-[16/7] overflow-hidden rounded-3xl border border-ng-line-soft bg-gradient-to-br from-ng-sage/40 via-ng-cream to-ng-leaf-soft/40 shadow-[var(--shadow-ng-card)]">
              <div
                aria-hidden
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(31,77,46,0.06) 14px, rgba(31,77,46,0.06) 28px)",
                }}
              />
              <div className="absolute inset-0 grid place-items-center">
                <div className="glass-strong max-w-xs rounded-2xl px-6 py-4 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ng-forest">
                    Carrier · DTDC
                  </div>
                  <div className="mt-1 font-display text-[18px] text-ng-forest-deep">
                    Out for delivery
                  </div>
                  <div className="mt-1 text-[12px] text-ng-ink-muted">
                    ETA: today, 4 PM – 7 PM
                  </div>
                  <div className="mt-2 font-mono text-[12px] text-ng-forest">
                    AWB · 1Z999AA10123456
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Timeline */}
            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)]">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 font-display text-[20px] text-ng-forest-deep">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-sage/60 text-ng-forest-deep">
                    <Icon name="routing-2-bold" size={16} />
                  </span>
                  Delivery progress
                </h2>
                <Link href="/orders/track" className="inline-flex items-center gap-1 text-[13px] font-medium text-ng-forest hover:underline">
                  Live tracking <Icon name="alt-arrow-right-linear" size={14} />
                </Link>
              </div>
              <ol className="relative">
                {TIMELINE.map((t, i) => {
                  const last = i === TIMELINE.length - 1;
                  return (
                    <li key={t.label} className="relative flex gap-4 pb-7 last:pb-0">
                      {/* Connecting rail */}
                      {!last ? (
                        <span
                          aria-hidden
                          className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${
                            t.done ? "bg-ng-forest/70" : "bg-ng-line"
                          }`}
                        />
                      ) : null}
                      {/* Node */}
                      <span
                        className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-ng-paper ${
                          t.active
                            ? "bg-ng-clay text-ng-forest-deep shadow-[0_0_0_4px_rgba(181,134,47,0.18)]"
                            : t.done
                              ? "bg-ng-forest text-ng-cream"
                              : "bg-ng-sage/60 text-ng-ink-soft"
                        }`}
                      >
                        {t.active ? (
                          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-ng-clay/40" />
                        ) : null}
                        <Icon name={t.icon} size={17} className="relative" />
                      </span>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[14.5px] font-medium ${t.done || t.active ? "text-ng-ink" : "text-ng-ink-soft"}`}>
                            {t.label}
                          </span>
                          {t.active ? (
                            <span className="rounded-full bg-ng-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ng-clay-deep">
                              Now
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[12px] text-ng-ink-soft">{t.time}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Items */}
            <section>
              <h2 className="mb-4 flex items-center gap-2.5 font-display text-[22px] text-ng-forest-deep">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ng-sage/60 text-ng-forest-deep">
                  <Icon name="bag-4-bold" size={16} />
                </span>
                Items in this order
              </h2>
              <div className="space-y-3">
                {lines.map((l) => (
                  <article
                    key={l.id}
                    className="ng-float flex items-center gap-5 rounded-2xl border border-ng-line-soft bg-ng-paper p-5 transition-all hover:border-ng-leaf/50"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ng-cream-deep">
                      <Image src={l.image} alt={l.title} fill className="object-cover" sizes="80px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {l.slug ? (
                        <Link
                          href={`/products/${l.slug}`}
                          className="line-clamp-1 font-display text-[16px] text-ng-forest-deep transition-colors hover:text-ng-leaf"
                        >
                          {l.title}
                        </Link>
                      ) : (
                        <span className="line-clamp-1 font-display text-[16px] text-ng-forest-deep">
                          {l.title}
                        </span>
                      )}
                      <div className="mt-1 flex items-center gap-4 text-[12px] text-ng-ink-soft">
                        <span>Qty {l.qty}</span>
                        <span className="font-mono">lot · {l.lot}</span>
                        <Link href="/traceability" className="text-ng-forest hover:underline">
                          Trace this lot →
                        </Link>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-[18px] text-ng-forest-deep">
                        ₹{l.lineTotal.toLocaleString("en-IN")}
                      </div>
                      <button className="mt-1 text-[12px] text-ng-forest hover:underline">
                        Reorder
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Summary */}
          <aside className="space-y-5 self-start lg:sticky lg:top-24">
            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)]">
              <h2 className="mb-4 flex items-center gap-2 font-display text-[18px] text-ng-forest-deep">
                <Icon name="bill-list-bold" size={17} className="text-ng-forest" />
                Summary
              </h2>
              <dl className="space-y-2 text-[13px]">
                <Row label="Subtotal" value={`₹${subtotal.toLocaleString("en-IN")}`} />
                <Row label="Shipping" value={shipping ? `₹${shipping.toLocaleString("en-IN")}` : "Free"} />
                <Row label="GST (incl.)" value="₹132" />
                <Row label="Wallet credit" value="− ₹0" />
              </dl>
              <div className="mt-3 flex items-baseline justify-between border-t border-ng-line-soft pt-3">
                <span className="font-display text-[16px]">Total paid</span>
                <span className="font-display text-[22px] tabular-nums text-ng-forest-deep">
                  ₹{total.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 text-[13px] shadow-[var(--shadow-ng-card)]">
              <h3 className="mb-2 flex items-center gap-2 font-display text-[16px] text-ng-forest-deep">
                <Icon name="map-point-bold" size={16} className="text-ng-forest" />
                Shipping to
              </h3>
              <p className="leading-relaxed text-ng-ink-muted">
                {stored?.address ? (
                  <>
                    {stored.address.fullName}
                    <br />
                    {stored.address.line1}
                    {stored.address.line2 ? (
                      <>
                        <br />
                        {stored.address.line2}
                      </>
                    ) : null}
                    <br />
                    {stored.address.city}, {stored.address.state} {stored.address.pincode}
                    <br />
                    {stored.address.phone}
                  </>
                ) : (
                  <>
                    Anjali Rao
                    <br />
                    42 Banyan Street, Madhapur
                    <br />
                    Hyderabad, Telangana 500081
                    <br />
                    +91 98xxx xxxxx
                  </>
                )}
              </p>
            </div>

            <div className="space-y-2.5">
              <Button variant="outline" fullWidth asChild>
                <Link href={`/orders/${id}/invoice`}>Download invoice</Link>
              </Button>
              <Button variant="ghost" fullWidth asChild>
                <Link href="mailto:care@nutrigreenz.in">Report an issue</Link>
              </Button>
            </div>

            {/* No cancel action — short no-cancellation note instead (§3.9). */}
            <NoCancellationNotice />
          </aside>
        </div>
      </div>
    </AccountShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ng-ink-muted">{label}</dt>
      <dd className="font-medium text-ng-ink">{value}</dd>
    </div>
  );
}
