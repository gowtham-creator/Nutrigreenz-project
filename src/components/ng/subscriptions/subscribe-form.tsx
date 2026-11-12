"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Chip } from "@/components/ng/chip";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";
import { AddressPicker } from "@/components/ng/checkout/address-picker";
import { SlotPicker } from "@/components/ng/checkout/slot-picker";
import { useAuth } from "@/lib/auth";
import { useAddresses } from "@/lib/addresses";
import { useCommerceRules, useCommerceStatus } from "@/lib/commerce";
import { cn } from "@/lib/utils";
import {
  FREQUENCIES,
  addDays,
  applySubscriberDiscountPaise,
  formatDeliveryDate,
  indiaToday,
  startWindow,
  type FrequencyDays,
} from "@/lib/subscriptions-core";
import {
  createSubscription,
  fetchPaymentMethods,
  goToGateway,
  inr,
  payDelivery,
  subscriptionErrorMessage,
  SubscriptionApiError,
} from "@/lib/subscriptions-client";

export interface SubscribeVariant {
  id: string;
  label: string;
  /** Live price in whole rupees. */
  price: number;
  inStock: boolean;
  image: string | null;
}

const START_CHOICES = 14;

const STEP_CARD =
  "rounded-3xl border border-ng-line-soft bg-ng-paper p-5 shadow-[var(--shadow-ng-card)] sm:p-7";

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ng-forest text-[14px] font-bold text-ng-cream">
        {n}
      </span>
      <div>
        <h2 className="font-display text-[20px] leading-tight text-ng-forest-deep">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] text-ng-ink-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function SubscribeForm({
  product,
  variants,
  initialVariantId,
  initialQty,
  discountBps,
}: {
  product: { slug: string; title: string; image: string };
  variants: SubscribeVariant[];
  initialVariantId: string;
  initialQty: number;
  discountBps: number;
}) {
  const router = useRouter();
  const { isAuthed, loading: authLoading } = useAuth();
  const { addresses, defaultAddress } = useAddresses();
  const rules = useCommerceRules();
  const { slotsStatus, refreshRules } = useCommerceStatus();

  const [variantId, setVariantId] = useState(initialVariantId);
  const [qty, setQty] = useState(initialQty);
  const [frequency, setFrequency] = useState<FrequencyDays>(30);
  const [startOn, setStartOn] = useState<string | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [payment, setPayment] = useState<"upi" | "cod" | null>(null);
  const [methods, setMethods] = useState<("upi" | "cod")[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The date chips render only for a signed-in customer, which is never the
  // server render (auth settles in the browser), so reading the clock here
  // cannot cause a hydration mismatch.
  const today = useMemo(() => indiaToday(), []);
  const dates = useMemo(() => {
    const { earliest } = startWindow(today);
    return Array.from({ length: START_CHOICES }, (_, i) => addDays(earliest, i));
  }, [today]);
  const chosenStart = startOn ?? dates[0] ?? null;

  useEffect(() => {
    let alive = true;
    void fetchPaymentMethods().then(({ methods: m }) => {
      if (!alive) return;
      setMethods(m);
      setPayment((p) => p ?? (m.includes("upi") ? "upi" : m[0] ?? null));
    });
    return () => {
      alive = false;
    };
  }, []);

  const resolvedAddressId = addressId ?? defaultAddress?.id ?? null;
  const address = addresses.find((a) => a.id === resolvedAddressId) ?? null;
  const slots = rules.deliverySlots;
  const resolvedSlotId = slotId ?? slots[0]?.id ?? null;

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const unitPaise = Math.round(variant.price * 100);
  const subscriberUnitPaise = applySubscriberDiscountPaise(unitPaise, discountBps);
  const perDeliveryPaise = subscriberUnitPaise * qty;
  const savingPaise = (unitPaise - subscriberUnitPaise) * qty;
  const percent = Math.round(discountBps / 100);

  const ready =
    isAuthed && variant.inStock && !!chosenStart && !!address && !!resolvedSlotId && !!payment && !submitting;

  async function submit() {
    if (!ready || !address || !resolvedSlotId || !payment || !chosenStart) return;
    setSubmitting(true);
    try {
      const { firstDelivery } = await createSubscription({
        items: [{ variantId: variant.id, qty }],
        frequencyDays: frequency,
        startOn: chosenStart,
        addressSnapshot: address,
        slotId: resolvedSlotId,
        paymentMethod: payment,
      });

      // First delivery is already due and paid online: go straight to the bank.
      if (firstDelivery && firstDelivery.status === "due" && payment === "upi") {
        try {
          const paid = await payDelivery(firstDelivery.id);
          if (paid.payment && goToGateway(paid.orderNumber, paid.payment)) return;
          toast.error("Subscription created, but we couldn't open the payment page. You can pay from My subscriptions.");
        } catch (err) {
          toast.error(`Subscription created. ${subscriptionErrorMessage(err)} You can pay from My subscriptions.`);
        }
        router.push("/account/subscriptions");
        return;
      }

      toast.success("Subscription started", {
        description:
          payment === "cod"
            ? `First delivery ${formatDeliveryDate(chosenStart)}. Pay the rider in cash.`
            : `First delivery ${formatDeliveryDate(chosenStart)}. We'll remind you to pay before each delivery.`,
      });
      router.push("/account/subscriptions");
    } catch (err) {
      if (err instanceof SubscriptionApiError && err.code === "unauthenticated") {
        router.replace(`/auth?next=${encodeURIComponent(`/subscribe?product=${product.slug}&variant=${variant.id}&qty=${qty}`)}`);
        return;
      }
      if (err instanceof SubscriptionApiError && err.code === "slot-unavailable") {
        setSlotId(null);
        void refreshRules();
      }
      toast.error(subscriptionErrorMessage(err));
      setSubmitting(false);
    }
  }

  const next = `/subscribe?product=${encodeURIComponent(product.slug)}&variant=${encodeURIComponent(variant.id)}&qty=${qty}`;

  if (authLoading || !isAuthed) {
    return (
      <Section className="!py-24">
        <Reveal className="mx-auto max-w-md">
          <div className={cn(STEP_CARD, "px-6 py-12 text-center")}>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
              <Icon name="refresh-bold" size={28} />
            </span>
            <h1 className="mt-6 font-display text-[26px] text-ng-forest-deep">
              {authLoading ? "One moment…" : "Sign in to subscribe"}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ng-ink-muted">
              {authLoading
                ? "Checking your session."
                : `Subscriptions are saved to your account so you can skip, pause or cancel any time. You save ${percent}% on every delivery.`}
            </p>
            {!authLoading ? (
              <Button variant="primary" size="lg" className="mt-7" asChild>
                <Link href={`/auth?next=${encodeURIComponent(next)}`}>Sign in to continue</Link>
              </Button>
            ) : null}
          </div>
        </Reveal>
      </Section>
    );
  }

  return (
    <Section className="!pt-8 !pb-24">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/products/${product.slug}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ng-leaf transition-colors hover:text-ng-forest"
        >
          ← Back to {product.title}
        </Link>
        <h1 className="mt-3 font-display text-[clamp(28px,4vw,42px)] leading-tight text-ng-forest-deep">
          Subscribe &amp; save {percent}%
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ng-ink-muted">
          Set it once and we deliver on schedule. Each delivery is paid separately, never charged automatically. Skip,
          pause or cancel whenever you like.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            {/* 1. Product */}
            <div className={STEP_CARD}>
              <StepTitle n={1} title="What to deliver" />
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-ng-cream">
                  {variant.image || product.image ? (
                    <Image
                      src={variant.image || product.image}
                      alt={product.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[18px] leading-tight text-ng-forest-deep">{product.title}</p>
                  <p className="mt-1 text-[14px] text-ng-ink-muted">
                    <span className="font-semibold text-ng-forest-deep tabular-nums">{inr(subscriberUnitPaise)}</span>{" "}
                    <span className="line-through tabular-nums">{inr(unitPaise)}</span> each
                  </p>
                </div>
              </div>
              {variants.length > 1 ? (
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {variants.map((v) => (
                    <Chip
                      key={v.id}
                      active={v.id === variant.id}
                      onClick={() => setVariantId(v.id)}
                      disabled={!v.inStock}
                    >
                      {v.label}
                      {!v.inStock ? " · sold out" : ""}
                    </Chip>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 flex items-center gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-ng-ink-muted">Quantity</span>
                <div className="flex items-center gap-1 rounded-full border border-ng-line bg-ng-cream/50 p-1">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-ng-paper text-[20px] font-semibold text-ng-forest-deep ring-1 ring-ng-line/60 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-[15px] font-bold tabular-nums text-ng-forest-deep" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={qty >= 20}
                    onClick={() => setQty((q) => Math.min(20, q + 1))}
                    className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-ng-forest text-[20px] font-semibold text-ng-cream disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Frequency */}
            <div className={STEP_CARD}>
              <StepTitle n={2} title="How often" hint="You can change this later." />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.days}
                    type="button"
                    onClick={() => setFrequency(f.days)}
                    aria-pressed={frequency === f.days}
                    className={cn(
                      "cursor-pointer rounded-2xl border px-4 py-3.5 text-left transition-colors",
                      frequency === f.days
                        ? "border-ng-forest bg-ng-leaf/10 ring-1 ring-ng-forest"
                        : "border-ng-line hover:border-ng-leaf-soft",
                    )}
                  >
                    <span className="block text-[15px] font-semibold text-ng-forest-deep">{f.short}</span>
                    <span className="block text-[12px] text-ng-ink-muted">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. First delivery */}
            <div className={STEP_CARD}>
              <StepTitle n={3} title="First delivery" hint="Later deliveries follow on the same cycle." />
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {dates.map((d) => (
                  <Chip key={d} active={d === chosenStart} onClick={() => setStartOn(d)}>
                    {formatDeliveryDate(d)}
                  </Chip>
                ))}
              </div>
            </div>

            {/* 4. Address */}
            <div>
              <AddressPicker addresses={addresses} selectedId={resolvedAddressId} onSelect={setAddressId} />
            </div>

            {/* 5. Slot */}
            <SlotPicker
              slots={slots}
              status={slotsStatus}
              onRetry={() => void refreshRules()}
              selectedId={resolvedSlotId}
              onSelect={setSlotId}
            />

            {/* 6. Payment */}
            <div className={STEP_CARD}>
              <StepTitle n={6} title="How you'll pay" hint="Each delivery is paid on its own. Nothing is charged automatically." />
              {methods === null ? (
                <p className="text-[14px] text-ng-ink-muted">Checking payment options…</p>
              ) : methods.length === 0 ? (
                <p className="text-[14px] text-ng-ink-muted">No payment option is open right now. Please try again soon.</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {methods.includes("upi") ? (
                    <button
                      type="button"
                      onClick={() => setPayment("upi")}
                      aria-pressed={payment === "upi"}
                      className={cn(
                        "cursor-pointer rounded-2xl border px-4 py-3.5 text-left transition-colors",
                        payment === "upi" ? "border-ng-forest bg-ng-leaf/10 ring-1 ring-ng-forest" : "border-ng-line hover:border-ng-leaf-soft",
                      )}
                    >
                      <span className="block text-[15px] font-semibold text-ng-forest-deep">Pay online</span>
                      <span className="block text-[12px] text-ng-ink-muted">UPI, card or netbanking. We remind you 2 days before.</span>
                    </button>
                  ) : null}
                  {methods.includes("cod") ? (
                    <button
                      type="button"
                      onClick={() => setPayment("cod")}
                      aria-pressed={payment === "cod"}
                      className={cn(
                        "cursor-pointer rounded-2xl border px-4 py-3.5 text-left transition-colors",
                        payment === "cod" ? "border-ng-forest bg-ng-leaf/10 ring-1 ring-ng-forest" : "border-ng-line hover:border-ng-leaf-soft",
                      )}
                    >
                      <span className="block text-[15px] font-semibold text-ng-forest-deep">Cash on delivery</span>
                      <span className="block text-[12px] text-ng-ink-muted">Pay the rider each time.</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <aside className="h-fit lg:sticky lg:top-[96px]">
            <div className={STEP_CARD}>
              <h2 className="font-display text-[20px] text-ng-forest-deep">Your subscription</h2>
              <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ng-ink-muted">Product</dt>
                  <dd className="text-right font-medium text-ng-forest-deep">
                    {qty} × {variant.label}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ng-ink-muted">Delivered</dt>
                  <dd className="text-right font-medium text-ng-forest-deep">
                    {FREQUENCIES.find((f) => f.days === frequency)?.label}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ng-ink-muted">First delivery</dt>
                  <dd className="text-right font-medium text-ng-forest-deep">
                    {chosenStart ? formatDeliveryDate(chosenStart) : "…"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ng-ink-muted">You save</dt>
                  <dd className="text-right font-semibold text-ng-forest tabular-nums">{inr(savingPaise)} each time</dd>
                </div>
              </dl>
              <div className="mt-5 flex items-end justify-between border-t border-ng-line-soft pt-4">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-ng-ink-muted">Per delivery</span>
                <span className="font-display text-[28px] leading-none tabular-nums text-ng-forest-deep">
                  {inr(perDeliveryPaise)}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-ng-ink-muted">
                Plus delivery fee when below the free-delivery amount. Prices follow the live catalogue on each delivery.
              </p>
              <Button
                size="lg"
                fullWidth
                className="mt-5 cursor-pointer"
                disabled={!ready}
                onClick={() => void submit()}
              >
                <Icon name="refresh-bold" size={18} />
                {submitting
                  ? "Setting up…"
                  : payment === "upi" && chosenStart === dates[0]
                    ? `Subscribe & pay ${inr(perDeliveryPaise)}`
                    : "Start subscription"}
              </Button>
              {!variant.inStock ? (
                <p className="mt-3 text-[13px] text-ng-clay-deep">This size is sold out. Choose another size.</p>
              ) : !address ? (
                <p className="mt-3 text-[13px] text-ng-ink-muted">Add a delivery address to continue.</p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}
