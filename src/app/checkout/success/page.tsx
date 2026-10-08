"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useCart } from "@/lib/cart";
import {
  fetchMyOrder,
  inrFromPaise,
  OrdersAuthError,
  snapshotString,
  type OrderView,
} from "@/lib/orders-client";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { FloatIn, Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { NoCancellationNotice } from "@/components/ng/checkout/no-cancellation";
import { pointsEarned } from "@/components/ng/checkout/order-math";
import { clearCheckoutDraft } from "@/components/ng/checkout/checkout-draft";
import {
  loadReceipt,
  type OrderReceipt,
} from "@/components/ng/checkout/order-receipt";

/*
 * Landing on this URL proves nothing about payment.
 *
 * SBI's callback sends the customer here after it has confirmed the payment,
 * but anyone can open the URL, and the sessionStorage receipt is written BEFORE
 * the bank redirect. This page used to render "Order confirmed / Paid via /
 * Total paid" from that receipt and empty the cart on arrival, so a customer
 * whose payment was still unconfirmed (or had failed) was told it had gone
 * through, and lost the cart they needed to retry.
 *
 * So the page asks the server (the owner-scoped GET /api/orders/[number]) and
 * renders what it says. The receipt is only a fallback for display details the
 * server snapshot lacks (the payment label, say). It never decides the state.
 */

/** Re-check an online order the bank has not confirmed yet: every 3s for ~30s. */
const POLL_EVERY_MS = 3_000;
const POLL_FOR_MS = 30_000;
const MAX_CHECKS = 1 + POLL_FOR_MS / POLL_EVERY_MS;

type Problem = "signed-out" | "not-found";

type Phase =
  | "loading"
  | "confirmed"
  | "confirming"
  | "slow"
  | "failed"
  | "unavailable"
  | Problem;

/**
 * An online order is pending until SBI confirms it; a Cash on Delivery order is
 * pending until the cash is collected, which is normal and nothing to wait for.
 */
function awaitingPayment(order: OrderView): boolean {
  return order.paymentMethod !== "cod" && order.paymentStatus === "pending";
}

function phaseOf(
  order: OrderView | null,
  problem: Problem | null,
  gaveUp: boolean,
): Phase {
  if (problem) return problem;
  if (!order) return gaveUp ? "unavailable" : "loading";
  if (order.paymentMethod === "cod") return "confirmed";
  if (order.paymentStatus === "paid") return "confirmed";
  if (order.paymentStatus === "failed") return "failed";
  return gaveUp ? "slow" : "confirming";
}

/**
 * The order as the server has it, re-fetched while an online payment is still
 * pending. Network blips are retried inside the same window; a 401 or 404 is a
 * definite answer and stops.
 */
function useServerOrder(orderNumber: string) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;

    async function check() {
      checks += 1;
      try {
        const next = await fetchMyOrder(orderNumber, controller.signal);
        if (controller.signal.aborted) return;
        if (!next) {
          setProblem("not-found");
          return;
        }
        setOrder(next);
        if (!awaitingPayment(next)) return;
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof OrdersAuthError) {
          setProblem("signed-out");
          return;
        }
        // Anything else is transient: keep what we last showed and ask again.
      }
      if (checks < MAX_CHECKS) {
        timer = setTimeout(() => void check(), POLL_EVERY_MS);
      } else {
        setGaveUp(true);
      }
    }

    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderNumber]);

  return { order, problem, gaveUp };
}

const NOOP = () => () => {};

/** The checkout-time receipt, for display details only (never for state). */
function useReceipt(orderNumber: string): OrderReceipt | null {
  // Cache the read per order so getSnapshot returns a stable reference (avoids
  // the useSyncExternalStore infinite-loop guard).
  const getSnapshot = useMemo(() => {
    const cached = orderNumber ? loadReceipt(orderNumber) : null;
    return () => cached;
  }, [orderNumber]);
  // Server snapshot is always `null`, so the first client paint matches SSR.
  return useSyncExternalStore<OrderReceipt | null>(NOOP, getSnapshot, () => null);
}

function SuccessContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "";
  // Keyed so a different order starts from a clean slate.
  return orderNumber ? (
    <OrderOutcome key={orderNumber} orderNumber={orderNumber} />
  ) : (
    <OutcomeNotice phase="not-found" orderNumber="" />
  );
}

function OrderOutcome({ orderNumber }: { orderNumber: string }) {
  const { order, problem, gaveUp } = useServerOrder(orderNumber);
  const phase = phaseOf(order, problem, gaveUp);

  // Empty the cart and the saved checkout once, and only for an order the
  // server says is paid (online) or placed (Cash on Delivery). Until then the
  // customer may need both to try again from /checkout/failed.
  const { clear } = useCart();
  const cleared = useRef(false);
  useEffect(() => {
    if (phase !== "confirmed" || cleared.current) return;
    cleared.current = true;
    clear();
    clearCheckoutDraft();
  }, [phase, clear]);

  if (phase === "confirmed") return order ? <ConfirmedOrder order={order} /> : null;
  return <OutcomeNotice phase={phase} orderNumber={orderNumber} order={order} />;
}

/* ── confirmed ────────────────────────────────────────────────────────── */

function ConfirmedOrder({ order }: { order: OrderView }) {
  const receipt = useReceipt(order.orderNumber);
  const cod = order.paymentMethod === "cod";
  const total = inrFromPaise(order.totalPaise);

  const addr = order.addressSnapshot;
  const fullName = snapshotString(addr, "fullName") ?? receipt?.address?.fullName ?? null;
  const line1 = snapshotString(addr, "line1") ?? receipt?.address?.line1 ?? null;
  const line2 = snapshotString(addr, "line2") ?? receipt?.address?.line2 ?? null;
  const locality = [
    snapshotString(addr, "city") ?? receipt?.address?.city,
    snapshotString(addr, "state") ?? receipt?.address?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const pincode = snapshotString(addr, "pincode") ?? receipt?.address?.pincode ?? "";
  const slotLabel = snapshotString(order.slotSnapshot, "label") ?? receipt?.slotLabel ?? null;
  // The receipt only names the method ("UPI"); the server already said it is paid.
  const paidWith =
    receipt?.payment && receipt.payment.category !== "cod" ? receipt.payment.label : "online payment";

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
            <UiIcon name="verified" size={52} className="relative" />
          </span>
        </FloatIn>
        <span className="ng-eyebrow mt-6 text-ng-forest">Order confirmed</span>
        <h1 className="mt-2 font-display text-[clamp(32px,5vw,48px)] leading-tight text-ng-forest-deep">
          Thank you, your order is{" "}
          <em className="italic text-ng-leaf">in</em>
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ng-ink-muted">
          {cod
            ? "We've received your order and started packing it against the freshest farm lots. Please keep the amount ready for when it arrives."
            : "Your payment is confirmed and we've started packing your order against the freshest farm lots."}
        </p>
        <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-ng-line bg-ng-paper px-5 py-2.5 shadow-[var(--shadow-ng-card)]">
          <Icon name="bill-check-bold" size={16} className="text-ng-forest" />
          <span className="text-[13px] text-ng-ink-muted">Order ID</span>
          <span className="font-mono text-[15px] font-semibold tracking-wide tabular-nums text-ng-forest-deep">
            {order.orderNumber}
          </span>
        </div>
      </Reveal>

      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: delivery details */}
        <Stagger className="space-y-6">
          <StaggerItem className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)]">
            <h2 className="flex items-center gap-2.5 font-display text-[22px] text-ng-forest-deep">
              <Icon name="order" size={20} className="text-ng-leaf" />
              Delivery details
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
                  <UiIcon name="deliveryTime" size={18} />
                </span>
                <div>
                  <p className="text-[12px] uppercase tracking-wider text-ng-ink-soft">
                    Delivery slot
                  </p>
                  <p className="mt-1 text-[14px] font-medium text-ng-ink">
                    {slotLabel ?? "Earliest available slot"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
                  <UiIcon name="location" size={18} />
                </span>
                <div>
                  <p className="text-[12px] uppercase tracking-wider text-ng-ink-soft">
                    Shipping to
                  </p>
                  {line1 ? (
                    <div className="mt-1 text-[14px] leading-relaxed text-ng-ink">
                      {fullName ? <p className="font-medium">{fullName}</p> : null}
                      <p className="text-ng-ink-muted">
                        {line1}
                        {line2 ? `, ${line2}` : ""}
                      </p>
                      {locality || pincode ? (
                        <p className="text-ng-ink-muted">
                          {locality} {pincode}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-[14px] text-ng-ink-muted">
                      Your saved default address
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-5 flex items-center gap-2 border-t border-ng-line-soft pt-4 text-[13px] text-ng-ink-muted">
              <Icon name="card-bold" size={15} className="text-ng-forest" />
              {cod ? (
                <>
                  Cash on Delivery:{" "}
                  <span className="font-medium text-ng-ink">pay {total} when it arrives</span>
                </>
              ) : (
                <>
                  Paid via <span className="font-medium text-ng-ink">{paidWith}</span>
                </>
              )}
            </p>
          </StaggerItem>

          {/* Loyalty credit note */}
          <StaggerItem className="flex gap-3 rounded-2xl border border-ng-leaf/40 bg-ng-sage/30 p-5">
            <Icon name="star" size={22} className="mt-0.5 shrink-0 text-ng-forest" />
            <div>
              <p className="font-display text-[15px] text-ng-forest-deep">
                <span className="tabular-nums">{pointsEarned(order.totalPaise / 100)}</span>{" "}
                loyalty points will be credited after delivery
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ng-ink-muted">
                Points land in your wallet once your order is delivered. Redeem
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
              href={`/orders/${order.orderNumber}/invoice`}
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
                  <UiIcon name="bag" size={18} />
                  Continue shopping
                </Link>
              </Button>
            </div>
          </StaggerItem>
        </Stagger>

        {/* Right: order summary, from the server's figures */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-float)]">
            <ServerOrderSummary order={order} />
          </div>
          <p className="mt-3 text-center text-[12px] text-ng-ink-soft">
            {cod ? "Pay on delivery" : "Total paid"} ·{" "}
            <span className="font-mono font-semibold tabular-nums text-ng-forest">{total}</span>
          </p>
        </aside>
      </div>
    </Section>
  );
}

function SummaryRow({ label, value, discount }: { label: string; value: string; discount?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[14px]">
      <span className="text-ng-ink-muted">{label}</span>
      <span
        className={
          discount
            ? "font-semibold tabular-nums text-ng-green-bright"
            : "font-medium tabular-nums text-ng-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The order summary as the server priced it. Same look as the checkout
 * summary, but every figure is what was persisted, never a client recompute.
 */
function ServerOrderSummary({ order }: { order: OrderView }) {
  return (
    <div>
      <h2 className="mb-5 font-display text-[22px] text-ng-forest-deep">Order summary</h2>
      <ul className="space-y-3">
        {order.items.map((item) => {
          const unit =
            snapshotString(item.snapshot, "variantLabel") ?? snapshotString(item.snapshot, "unit");
          return (
            <li key={item.id} className="flex gap-3 text-[13px]">
              <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-ng-forest px-1.5 text-[11px] font-bold tabular-nums text-ng-cream">
                {item.qty}
              </span>
              <div className="flex-1">
                <div className="line-clamp-2 font-medium leading-tight text-ng-ink">{item.title}</div>
                {unit ? <div className="mt-0.5 text-[11px] text-ng-ink-soft">{unit}</div> : null}
              </div>
              <div className="text-[14px] font-medium tabular-nums text-ng-forest-deep">
                {inrFromPaise(item.lineTotalPaise)}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 space-y-2.5 border-t border-ng-line-soft pt-5">
        <SummaryRow label="Subtotal" value={inrFromPaise(order.subtotalPaise)} />
        {order.discountPaise > 0 ? (
          <SummaryRow
            label={order.couponCode ? `Coupon (${order.couponCode})` : "Discount"}
            value={`− ${inrFromPaise(order.discountPaise)}`}
            discount
          />
        ) : null}
        {order.loyaltyRedeemedPaise > 0 ? (
          <SummaryRow
            label="Loyalty points"
            value={`− ${inrFromPaise(order.loyaltyRedeemedPaise)}`}
            discount
          />
        ) : null}
        <SummaryRow
          label="Shipping"
          value={order.shippingPaise > 0 ? inrFromPaise(order.shippingPaise) : "Free"}
        />
        {order.taxPaise > 0 ? <SummaryRow label="Tax" value={inrFromPaise(order.taxPaise)} /> : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-ng-line-soft pt-4">
        <span className="font-display text-[18px] text-ng-forest-deep">Total</span>
        <span className="font-display text-[28px] tabular-nums text-ng-forest-deep">
          {inrFromPaise(order.totalPaise)}
        </span>
      </div>
    </div>
  );
}

/* ── everything that is not (yet) a confirmed order ───────────────────── */

const CONTACT = { href: "/contact", label: "Contact support", icon: "chat-round-dots-bold" };
const MY_ORDERS = { href: "/account/orders", label: "View my orders", icon: "bill-check-bold" };

function OutcomeNotice({
  phase,
  orderNumber,
  order = null,
}: {
  phase: Exclude<Phase, "confirmed">;
  orderNumber: string;
  order?: OrderView | null;
}) {
  const amount = order ? inrFromPaise(order.totalPaise) : null;
  const ref = encodeURIComponent(orderNumber);

  let icon: ReactNode = <UiIcon name="caution" size={24} />;
  let title: string;
  let body: ReactNode;
  let actions: { href: string; label: string; icon: string }[] = [];
  let busy = false;

  switch (phase) {
    case "loading":
      busy = true;
      title = "Checking your order";
      body = "One moment while we look up your order.";
      break;
    case "confirming":
      busy = true;
      title = "Confirming your payment";
      body = (
        <>
          Your bank is confirming this payment. It usually takes a few seconds,
          so please keep this page open. There&apos;s no need to pay again.
        </>
      );
      break;
    case "slow":
      icon = <Icon name="clock-circle-bold" size={24} />;
      title = "We're still confirming your payment";
      body = (
        <>
          This is taking longer than usual. If money left your account,
          don&apos;t pay again. We&apos;ll email you as soon as your payment
          is confirmed and your order is placed.
        </>
      );
      actions = [MY_ORDERS, CONTACT];
      break;
    case "failed":
      title = "Your payment didn't go through";
      body = (
        <>
          This payment wasn&apos;t completed, so your order hasn&apos;t been
          placed. Your bag is still saved.
        </>
      );
      actions = [
        { href: `/checkout/failed?order=${ref}`, label: "See what happened", icon: "arrow-right-linear" },
        CONTACT,
      ];
      break;
    case "signed-out":
      icon = <Icon name="lock-keyhole-minimalistic-bold" size={24} />;
      title = "Sign in to see your order";
      body = "Order details are only shown to the account that placed the order.";
      actions = [
        {
          href: `/auth?next=${encodeURIComponent(`/checkout/success?order=${orderNumber}`)}`,
          label: "Sign in",
          icon: "lock-keyhole-minimalistic-bold",
        },
      ];
      break;
    case "not-found":
      title = "We couldn't find this order";
      body =
        "It may belong to a different account, or the link may be incomplete. Your orders page lists everything you've placed.";
      actions = [MY_ORDERS, CONTACT];
      break;
    case "unavailable":
      title = "We couldn't load your order just now";
      body = (
        <>
          If you paid online, don&apos;t pay again. Once the payment is
          confirmed we will email you, and the order will show on your orders
          page.
        </>
      );
      actions = [MY_ORDERS, CONTACT];
      break;
  }

  return (
    <Section className="py-14 sm:py-20">
      <div className="mx-auto max-w-xl">
        <FloatIn>
          <div
            className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 sm:p-8"
            role="status"
            aria-live="polite"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ng-sage/40 text-ng-forest-deep">
              {busy ? (
                <Icon name="refresh-bold" size={24} className="animate-spin motion-reduce:animate-none" />
              ) : (
                icon
              )}
            </span>

            <h1 className="mt-4 text-[22px] font-semibold leading-tight text-ng-forest-deep sm:text-[26px]">
              {title}
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-ng-ink-muted">{body}</p>

            {orderNumber ? (
              <p className="mt-4 rounded-xl bg-ng-sage/25 px-3.5 py-2.5 text-[13px] text-ng-forest-deep">
                Order reference{" "}
                <span className="select-all font-mono font-semibold">{orderNumber}</span>
                {amount && phase !== "not-found" ? (
                  <>
                    {" "}
                    · Amount <span className="font-mono font-semibold tabular-nums">{amount}</span>
                  </>
                ) : null}
              </p>
            ) : null}

            {actions.length > 0 ? (
              <Reveal>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  {actions.map((a, i) => (
                    <Button key={a.href} asChild variant={i === 0 ? "primary" : "secondary"} size="lg">
                      <Link href={a.href}>
                        <Icon name={a.icon} size={18} />
                        {a.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </Reveal>
            ) : null}
          </div>
        </FloatIn>
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
