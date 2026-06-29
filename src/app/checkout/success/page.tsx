"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useSyncExternalStore } from "react";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { FloatIn, Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { OrderSummary } from "@/components/ng/checkout/order-summary";
import { NoCancellationNotice } from "@/components/ng/checkout/no-cancellation";
import { INR } from "@/components/ng/checkout/order-math";
import {
  loadReceipt,
  type OrderReceipt,
} from "@/components/ng/checkout/order-receipt";

const NOOP = () => () => {};

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("order") ?? "NG-25-0000";
  // Cache the receipt read per orderId so getSnapshot returns a stable
  // reference (avoids the useSyncExternalStore infinite-loop guard).
  const getSnapshot = useMemo(() => {
    const cached = loadReceipt(orderId);
    return () => cached;
  }, [orderId]);
  // Server snapshot is always `null`, so the first client paint matches SSR,
  // then useSyncExternalStore swaps in the real receipt on hydration.
  const receipt = useSyncExternalStore<OrderReceipt | null>(
    NOOP,
    getSnapshot,
    () => null,
  );
  const hydrated = typeof window !== "undefined";

  const address = receipt?.address ?? null;

  return (
    <Section className="relative !pt-12 !pb-24">
      {/* celebratory background blooms */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-ng-leaf/12 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-10 top-40 -z-10 h-64 w-64 rounded-full bg-ng-clay/10 blur-3xl"
      />

      {/* Success header */}
      <Reveal className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center">
        <FloatIn>
          <span className="relative grid h-24 w-24 place-items-center rounded-full bg-ng-leaf/15 text-ng-green-bright ring-8 ring-ng-leaf/10">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-ng-leaf/20 [animation-duration:2.5s] motion-reduce:hidden"
            />
            <Icon name="check-circle-bold" size={52} className="relative" />
          </span>
        </FloatIn>
        <span className="ng-eyebrow mt-6 text-ng-forest">Order confirmed</span>
        <h1 className="mt-2 font-display text-[clamp(32px,5vw,48px)] leading-tight text-ng-forest-deep">
          Thank you — your order is{" "}
          <em className="italic text-ng-leaf">in</em>
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ng-ink-muted">
          We&apos;ve received your order and started packing it against the
          freshest farm lots. A confirmation has been sent to your registered
          number.
        </p>
        <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-ng-line bg-ng-paper px-5 py-2.5 shadow-[var(--shadow-ng-card)]">
          <Icon name="bill-check-bold" size={16} className="text-ng-forest" />
          <span className="text-[13px] text-ng-ink-muted">Order ID</span>
          <span className="font-mono text-[15px] font-semibold tracking-wide tabular-nums text-ng-forest-deep">
            {orderId}
          </span>
        </div>
      </Reveal>

      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left — delivery details */}
        <Stagger className="space-y-6">
          {/* Delivery slot + address */}
          <StaggerItem className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)]">
            <h2 className="flex items-center gap-2.5 font-display text-[22px] text-ng-forest-deep">
              <Icon name="box-bold" size={20} className="text-ng-leaf" />
              Delivery details
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest-deep">
                  <Icon name="clock-circle-bold" size={18} />
                </span>
                <div>
                  <p className="text-[12px] uppercase tracking-wider text-ng-ink-soft">
                    Delivery slot
                  </p>
                  <p className="mt-1 text-[14px] font-medium text-ng-ink">
                    {receipt?.slotLabel ?? "Earliest available slot"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest-deep">
                  <Icon name="map-point-bold" size={18} />
                </span>
                <div>
                  <p className="text-[12px] uppercase tracking-wider text-ng-ink-soft">
                    Shipping to
                  </p>
                  {address ? (
                    <div className="mt-1 text-[14px] leading-relaxed text-ng-ink">
                      <p className="font-medium">{address.fullName}</p>
                      <p className="text-ng-ink-muted">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                      </p>
                      <p className="text-ng-ink-muted">
                        {address.city}, {address.state} {address.pincode}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[14px] text-ng-ink-muted">
                      Your saved default address
                    </p>
                  )}
                </div>
              </div>
            </div>
            {receipt ? (
              <p className="mt-5 flex items-center gap-2 border-t border-ng-line-soft pt-4 text-[13px] text-ng-ink-muted">
                <Icon name="card-bold" size={15} className="text-ng-forest" />
                Paid via{" "}
                <span className="font-medium text-ng-ink">
                  {receipt.payment.label}
                </span>
              </p>
            ) : null}
          </StaggerItem>

          {/* Loyalty credit note */}
          <StaggerItem className="flex gap-3 rounded-2xl border border-ng-leaf/40 bg-ng-sage/30 p-5">
            <Icon
              name="medal-ribbon-star-bold"
              size={22}
              className="mt-0.5 shrink-0 text-ng-forest"
            />
            <div>
              <p className="font-display text-[15px] text-ng-forest-deep">
                <span className="tabular-nums">{receipt?.pointsToEarn ?? 0}</span>{" "}
                loyalty points will be credited after delivery
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ng-ink-muted">
                Points land in your wallet once your order is delivered — redeem
                them on a future order (10 points = ₹1).
              </p>
            </div>
          </StaggerItem>

          {/* No-cancellation restated */}
          <StaggerItem>
            <NoCancellationNotice />
          </StaggerItem>

          {/* Invoice + CTAs */}
          <StaggerItem className="flex flex-col gap-4">
            <Link
              href={`/orders/${orderId}/invoice`}
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-ng-forest transition-colors hover:text-ng-forest-deep"
            >
              <Icon name="download-minimalistic-bold" size={18} />
              Download invoice
            </Link>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" size="lg" asChild>
                <Link href="/orders/track">
                  <Icon name="map-arrow-square-bold" size={18} />
                  Track order
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/shop">
                  <Icon name="bag-4-bold" size={18} />
                  Continue shopping
                </Link>
              </Button>
            </div>
          </StaggerItem>
        </Stagger>

        {/* Right — order summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-float)]">
            {hydrated && receipt ? (
              <OrderSummary
                items={receipt.items}
                loyaltyPoints={receipt.loyaltyPoints || undefined}
                totals={{
                  subtotal: receipt.subtotal,
                  couponDiscount: receipt.couponDiscount,
                  loyaltyDiscount: receipt.loyaltyDiscount,
                  shipping: receipt.shipping,
                  freeDeliveryThreshold: 599,
                  tax: receipt.tax ?? 0,
                  taxRateBps: 0,
                  total: receipt.total,
                  taxInclusive: receipt.taxInclusive,
                }}
              />
            ) : (
              <div className="text-center">
                <h2 className="font-display text-[22px] text-ng-forest-deep">
                  Order summary
                </h2>
                <p className="mt-4 text-[14px] text-ng-ink-muted">
                  Your order <span className="font-medium">{orderId}</span> has
                  been placed. A detailed receipt has been emailed to you.
                </p>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  className="mt-5"
                  asChild
                >
                  <Link href="/orders/track">View order status</Link>
                </Button>
              </div>
            )}
          </div>
          {hydrated && receipt ? (
            <p className="mt-3 text-center text-[12px] text-ng-ink-soft">
              Total paid ·{" "}
              <span className="font-mono font-semibold tabular-nums text-ng-forest">
                {INR(receipt.total)}
              </span>
            </p>
          ) : null}
        </aside>
      </div>
    </Section>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <PageShell hidePromo>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <SuccessContent />
      </Suspense>
    </PageShell>
  );
}
