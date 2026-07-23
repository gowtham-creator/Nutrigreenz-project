"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useCommerceRules } from "@/lib/commerce";
import { useLoyaltyConfig } from "@/lib/loyalty-config";
import { useAddresses } from "@/lib/addresses";
import { fetchServiceable } from "@/lib/serviceability";
import { fetchRewards } from "@/lib/rewards-client";
import type { Coupon } from "@/types/nutrigreenz";
import { FloatIn, MagneticHover, Reveal, Stagger, StaggerItem } from "@/components/ng/motion";
import { AddressPicker } from "@/components/ng/checkout/address-picker";
import { SlotPicker } from "@/components/ng/checkout/slot-picker";
import { RewardsPanel } from "@/components/ng/checkout/rewards-panel";
import {
  PaymentPicker,
  type PaymentSelection,
} from "@/components/ng/checkout/payment-picker";
import { NoCancellationAck } from "@/components/ng/checkout/no-cancellation";
import { OrderSummary } from "@/components/ng/checkout/order-summary";
import {
  clearCheckoutDraft,
  readCheckoutDraft,
  writeCheckoutDraft,
} from "@/components/ng/checkout/checkout-draft";
import {
  computeTotals,
  generateOrderId,
  INR,
  maxRedeemableRupees,
  pointsEarned,
} from "@/components/ng/checkout/order-math";
import { saveReceipt } from "@/components/ng/checkout/order-receipt";

const CHECKOUT_STEPS = [
  { label: "Address", icon: "map-point-bold" },
  { label: "Slot", icon: "clock-circle-bold" },
  { label: "Rewards", icon: "ticket-bold" },
  { label: "Payment", icon: "wallet-money-bold" },
  { label: "Review", icon: "shield-check-bold" },
] as const;

/** Horizontal step indicator giving the checkout a guided, premium feel. */
function CheckoutStepper() {
  return (
    <Reveal>
      <ol className="mb-8 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-ng-line-soft bg-ng-paper/70 p-2.5 backdrop-blur sm:gap-2 sm:p-3">
        {CHECKOUT_STEPS.map((step, i) => (
          <li key={step.label} className="flex flex-1 items-center gap-1.5 last:flex-none sm:flex-none sm:shrink-0 sm:gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-ng-sage/40 px-3 py-1.5 text-[12px] font-semibold text-ng-forest sm:px-3.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ng-forest text-[10px] font-bold text-ng-cream tabular-nums">
                {i + 1}
              </span>
              <Icon name={step.icon} size={14} className="hidden text-ng-forest sm:inline" />
              <span className="hidden sm:inline">{step.label}</span>
            </span>
            {i < CHECKOUT_STEPS.length - 1 ? (
              <span aria-hidden className="h-px flex-1 bg-ng-line sm:w-5 sm:flex-none" />
            ) : null}
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const { isAuthed, account, loading: authLoading } = useAuth();
  const rules = useCommerceRules();
  const { config: loyalty } = useLoyaltyConfig();
  const { addresses, defaultAddress } = useAddresses();

  // Live Harvest-Coins balance from the append-only ledger (0 until loaded /
  // when signed out). Refetched when auth settles so the wallet is accurate.
  const [loyaltyAvailable, setLoyaltyAvailable] = useState(0);
  useEffect(() => {
    if (!isAuthed) {
      setLoyaltyAvailable(0);
      return;
    }
    let live = true;
    void fetchRewards().then((r) => {
      if (live) setLoyaltyAvailable(r.balance);
    });
    return () => {
      live = false;
    };
  }, [isAuthed]);

  const [addressId, setAddressId] = useState<string | null>(
    defaultAddress?.id ?? null,
  );
  const [slotId, setSlotId] = useState<string | null>(
    rules.deliverySlots[0]?.id ?? null,
  );
  const [payment, setPayment] = useState<PaymentSelection | null>(null);
  const [applied, setApplied] = useState<{
    coupon: Coupon;
    discount: number;
  } | null>(null);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  // Pre-acknowledged by default (client request) so the order can be placed
  // without an extra click; the shopper can still untick to opt out.
  const [acknowledged, setAcknowledged] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  // Guards the place-order button while the order is being persisted server-side.
  const [placing, setPlacing] = useState(false);
  // Serviceability of the selected delivery pincode (null = not yet checked).
  const [serviceable, setServiceable] = useState<boolean | null>(null);

  // Gate: require sign-in BEFORE checkout. If auth has settled and the visitor
  // isn't signed in, bounce them to /auth and bring them right back here.
  useEffect(() => {
    if (!authLoading && !isAuthed) router.replace("/auth?next=/checkout");
  }, [authLoading, isAuthed, router]);

  // Restore any saved in-progress checkout (abandoned-checkout recovery) once,
  // after mount, so a returning customer picks up where they left off.
  useEffect(() => {
    const draft = readCheckoutDraft();
    if (draft) {
      if (draft.addressId !== undefined) setAddressId(draft.addressId);
      if (draft.slotId !== undefined) setSlotId(draft.slotId);
      if (draft.payment !== undefined) setPayment(draft.payment ?? null);
      if (draft.applied !== undefined) setApplied(draft.applied ?? null);
      if (typeof draft.redeemLoyalty === "boolean") setRedeemLoyalty(draft.redeemLoyalty);
      // `acknowledged` is intentionally NOT restored — the no-cancellation box
      // must always start checked (client request), never reopen unticked.
    }
    setDraftLoaded(true);
  }, []);

  // Persist the draft on every change (after the initial restore).
  useEffect(() => {
    if (!draftLoaded) return;
    writeCheckoutDraft({ addressId, slotId, payment, applied, redeemLoyalty });
  }, [draftLoaded, addressId, slotId, payment, applied, redeemLoyalty]);

  // Keep the selected address in sync with the (async-hydrated) default.
  const resolvedAddressId =
    addressId ?? defaultAddress?.id ?? addresses[0]?.id ?? null;
  const selectedAddress =
    addresses.find((a) => a.id === resolvedAddressId) ?? null;
  const resolvedSlotId = slotId ?? rules.deliverySlots[0]?.id ?? null;
  const selectedSlot =
    rules.deliverySlots.find((s) => s.id === resolvedSlotId) ?? null;

  // Check the selected address's pincode against the live serviceable-areas list.
  const selectedPincode = selectedAddress?.pincode ?? null;
  useEffect(() => {
    if (!selectedPincode) {
      setServiceable(null);
      return;
    }
    let cancelled = false;
    setServiceable(null);
    fetchServiceable(selectedPincode).then((ok) => {
      if (!cancelled) setServiceable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPincode]);
  const notServiceable = serviceable === false;

  const couponDiscount = applied?.discount ?? 0;
  // Loyalty redemption uses the Super-Admin-configured ratio + limits.
  const meetsMinRedeem = loyaltyAvailable >= loyalty.minRedeemPoints;
  const maxRedeemFromBalance = maxRedeemableRupees(
    loyaltyAvailable,
    loyalty.redeemPointsPerRupee,
  );
  const maxRedeemFromCap = Math.floor(
    (subtotal * loyalty.maxRedeemPercent) / 100,
  );
  const loyaltyRupees = meetsMinRedeem
    ? Math.min(maxRedeemFromBalance, maxRedeemFromCap)
    : 0;
  const loyaltyDiscount = redeemLoyalty ? loyaltyRupees : 0;
  const loyaltyPointsUsed = redeemLoyalty
    ? loyaltyRupees * loyalty.redeemPointsPerRupee
    : 0;

  const totals = useMemo(
    () =>
      computeTotals({
        subtotal,
        couponDiscount,
        loyaltyDiscount,
        rules,
      }),
    [subtotal, couponDiscount, loyaltyDiscount, rules],
  );

  const belowMinimum = subtotal > 0 && subtotal < rules.minOrderValue;
  const canPlace =
    items.length > 0 &&
    !!selectedAddress &&
    !!selectedSlot &&
    !!payment &&
    acknowledged &&
    !belowMinimum &&
    !notServiceable;

  async function handlePlaceOrder() {
    if (placing) return;
    if (!canPlace || !selectedAddress || !selectedSlot || !payment) {
      if (belowMinimum) {
        toast.error(`Minimum order value is ${INR(rules.minOrderValue)}.`);
      } else if (!selectedAddress) {
        toast.error("Please select a delivery address.");
      } else if (notServiceable) {
        toast.error(`We don't deliver to ${selectedAddress.pincode} yet.`);
      } else if (!payment) {
        toast.error("Please choose a payment method.");
      } else if (!acknowledged) {
        toast.error("Please acknowledge the no-cancellation policy.");
      }
      return;
    }

    setPlacing(true);

    // Persist the order server-side. The backend re-prices every line from the
    // catalog + live commerce rules (client totals are ignored) and returns the
    // canonical NG-YY-XXXX order number. Money crosses the wire as integer paise.
    let orderNumber = generateOrderId();
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId ?? null,
            variantId: i.variantId ?? null,
            variantSku: i.variantSku ?? null,
            title: i.title,
            qty: i.qty,
            snapshot: {
              image: i.image,
              unit: i.unit,
              price: i.price,
              variantLabel: i.variantLabel,
              lineId: i.lineId,
            },
          })),
          couponCode: applied?.coupon.code ?? null,
          discountPaise: Math.round(couponDiscount * 100),
          loyaltyRedeemedPaise: Math.round(loyaltyDiscount * 100),
          addressSnapshot: selectedAddress,
          slotSnapshot: selectedSlot,
          userEmail: account?.email ?? null,
          userPhone: account?.phone ?? null,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { orderNumber?: string };
        if (data?.orderNumber) orderNumber = data.orderNumber;
      } else if (res.status === 401) {
        // Session expired between gate and submit — send them to re-auth.
        toast.error("Please sign in again to place your order.");
        setPlacing(false);
        router.replace("/auth?next=/checkout");
        return;
      }
      // For any other non-OK (503 Supabase-unconfigured, 500…), fall through:
      // we still confirm the order client-side so the UX never dead-ends. The
      // success page reads the local receipt; payment stays pending regardless.
    } catch {
      // Network error — keep the customer's purchase flow intact via the receipt.
    }

    // Local receipt powers the confirmation, history-detail and invoice views.
    // Keyed by the SAME order number the backend persisted, so they line up.
    saveReceipt({
      id: orderNumber,
      placedAt: new Date().toISOString(),
      items,
      subtotal,
      couponCode: applied?.coupon.code,
      couponDiscount,
      loyaltyPoints: loyaltyPointsUsed,
      loyaltyDiscount,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      taxInclusive: totals.taxInclusive,
      payment,
      slotLabel: selectedSlot.label,
      address: selectedAddress,
      pointsToEarn: pointsEarned(totals.total),
    });

    clear();
    clearCheckoutDraft();
    router.push(`/checkout/success?order=${orderNumber}`);
  }

  /* ── Auth gate ───────────────────────────────────────────────── */
  // Until auth settles, or while the redirect to sign-in is in flight, show a
  // lightweight holding screen instead of the checkout form.
  if (authLoading || !isAuthed) {
    return (
      <PageShell hidePromo>
        <Section className="!py-28">
          <Reveal className="mx-auto max-w-md">
            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper px-6 py-14 text-center shadow-[var(--shadow-ng-card)]">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ng-sage/40 text-ng-forest-deep">
                <Icon name="lock-keyhole-minimalistic-bold" size={28} />
              </span>
              <h1 className="mt-6 font-display text-[26px] text-ng-forest-deep">
                {authLoading ? "One moment…" : "Please sign in to continue"}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ng-ink-muted">
                {authLoading
                  ? "Checking your session."
                  : "Sign in so your order, address and details are saved to your account — then you'll come straight back to checkout."}
              </p>
              {!authLoading ? (
                <Button variant="primary" size="lg" className="mt-7" asChild>
                  <Link href="/auth?next=/checkout">
                    <Icon name="lock-keyhole-minimalistic-bold" size={18} />
                    Sign in to checkout
                  </Link>
                </Button>
              ) : null}
            </div>
          </Reveal>
        </Section>
      </PageShell>
    );
  }

  /* ── Empty state ─────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <PageShell hidePromo>
        <Section className="!py-28">
          <Reveal className="mx-auto max-w-lg">
            <div className="relative overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper px-6 py-16 text-center shadow-[var(--shadow-ng-card)]">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-ng-leaf/15 blur-3xl"
              />
              <div className="relative z-10 flex flex-col items-center">
                <FloatIn>
                  <span className="grid h-24 w-24 place-items-center rounded-full bg-ng-sage/40 text-ng-forest-deep ring-8 ring-ng-sage/20">
                    <Icon name="bag-smile-bold" size={42} />
                  </span>
                </FloatIn>
                <h1 className="mt-7 font-display text-[32px] text-ng-forest-deep">
                  Nothing to check out yet
                </h1>
                <p className="mt-3 max-w-sm text-[16px] leading-relaxed text-ng-ink-muted">
                  Your bag is empty. Fill it with cold-pressed oils, A2 ghee and
                  farm-fresh staples, then come back to complete your order.
                </p>
                <Button variant="primary" size="lg" className="mt-7" asChild>
                  <Link href="/shop">
                    <Icon name="bag-4-bold" size={18} />
                    Start shopping
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </Section>
      </PageShell>
    );
  }

  /* ── Full checkout ───────────────────────────────────────────── */
  return (
    <PageShell hidePromo>
      <Section
        className="!pt-12 !pb-24"
        eyebrow="Secure checkout"
        heading="Complete your order"
        description="Review your delivery details, apply rewards and pay securely. Everything is freshly packed from farm lots once you confirm."
      >
        <CheckoutStepper />

        <div className="relative grid gap-8 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_400px]">
          {/* Soft background blooms behind the columns */}
          <span
            aria-hidden
            className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-ng-leaf/10 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-20 bottom-20 -z-10 h-72 w-72 rounded-full bg-ng-clay/10 blur-3xl"
          />

          {/* Left column — selections */}
          <Stagger className="space-y-6">
            {belowMinimum ? (
              <StaggerItem>
                <div className="flex items-center gap-3 rounded-2xl border border-ng-danger/40 bg-ng-danger/10 p-4 text-[14px] text-ng-danger">
                  <Icon name="danger-triangle-bold" size={20} />
                  <span>
                    Add {INR(rules.minOrderValue - subtotal)} more to reach the{" "}
                    {INR(rules.minOrderValue)} minimum order value.
                  </span>
                </div>
              </StaggerItem>
            ) : null}

            {notServiceable && selectedAddress ? (
              <StaggerItem>
                <div className="flex items-center gap-3 rounded-2xl border border-ng-danger/40 bg-ng-danger/10 p-4 text-[14px] text-ng-danger">
                  <Icon name="map-point-bold" size={20} />
                  <span>
                    We don&apos;t deliver to{" "}
                    <span className="font-semibold tabular-nums">
                      {selectedAddress.pincode}
                    </span>{" "}
                    yet. Pick a different delivery address to continue.
                  </span>
                </div>
              </StaggerItem>
            ) : null}

            <StaggerItem>
              <AddressPicker
                addresses={addresses}
                selectedId={resolvedAddressId}
                onSelect={setAddressId}
              />
            </StaggerItem>

            <StaggerItem>
              <SlotPicker
                slots={rules.deliverySlots}
                selectedId={resolvedSlotId}
                onSelect={setSlotId}
              />
            </StaggerItem>

            <StaggerItem>
              <RewardsPanel
                subtotal={subtotal}
                appliedCoupon={applied}
                onApplyCoupon={(coupon, discount) =>
                  setApplied({ coupon, discount })
                }
                onRemoveCoupon={() => setApplied(null)}
                loyaltyAvailable={loyaltyAvailable}
                loyaltyRedeemed={loyaltyPointsUsed}
                onToggleLoyalty={setRedeemLoyalty}
                redeemPointsPerRupee={loyalty.redeemPointsPerRupee}
              />
            </StaggerItem>

            <StaggerItem>
              <PaymentPicker selected={payment} onSelect={setPayment} />
            </StaggerItem>

            <StaggerItem>
              <NoCancellationAck
                checked={acknowledged}
                onChange={setAcknowledged}
              />
            </StaggerItem>
          </Stagger>

          {/* Right column — summary + CTA */}
          <aside className="space-y-5 md:sticky md:top-24 md:self-start lg:top-24">
            <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-float)]">
              <OrderSummary
                items={items}
                totals={totals}
                loyaltyPoints={loyaltyPointsUsed || undefined}
              />

              {!isAuthed ? (
                <MagneticHover className="mt-6 block w-full">
                  <Button variant="primary" size="lg" fullWidth asChild>
                    <Link href="/auth?next=/checkout">
                      <Icon name="lock-keyhole-minimalistic-bold" size={18} />
                      Sign in to place order
                    </Link>
                  </Button>
                </MagneticHover>
              ) : canPlace ? (
                <MagneticHover className="mt-6 block w-full">
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={placing}
                    onClick={handlePlaceOrder}
                  >
                    <Icon
                      name={placing ? "refresh-bold" : "lock-keyhole-minimalistic-bold"}
                      size={18}
                      className={placing ? "animate-spin" : undefined}
                    />
                    {placing
                      ? "Placing order…"
                      : payment
                        ? `Pay ${INR(totals.total)} · ${payment.label}`
                        : `Place order · ${INR(totals.total)}`}
                  </Button>
                </MagneticHover>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="mt-6"
                  disabled
                  onClick={handlePlaceOrder}
                >
                  <Icon name="lock-keyhole-minimalistic-bold" size={18} />
                  {payment
                    ? `Pay ${INR(totals.total)} · ${payment.label}`
                    : `Place order · ${INR(totals.total)}`}
                </Button>
              )}

              {!isAuthed ? (
                <p className="mt-3 text-center text-[12px] text-ng-ink-soft">
                  Sign in or create an account to complete your purchase.
                </p>
              ) : notServiceable && selectedAddress ? (
                <p className="mt-3 text-center text-[12px] text-ng-danger">
                  We don&apos;t deliver to {selectedAddress.pincode} yet.
                </p>
              ) : !acknowledged ? (
                <p className="mt-3 text-center text-[12px] text-ng-ink-soft">
                  Acknowledge the no-cancellation policy to continue.
                </p>
              ) : (
                <p className="mt-3 text-center text-[12px] text-ng-ink-soft">
                  You&apos;ll earn{" "}
                  <span className="font-semibold text-ng-forest">
                    {pointsEarned(totals.total)} points
                  </span>{" "}
                  on this order.
                </p>
              )}

              <ul className="mt-6 space-y-1.5 border-t border-ng-line-soft pt-5 text-[12px] text-ng-ink-muted">
                <li className="flex items-center gap-2">
                  <Icon
                    name="check-circle-bold"
                    size={14}
                    className="text-ng-leaf"
                  />
                  Lot codes printed on every label
                </li>
                <li className="flex items-center gap-2">
                  <Icon
                    name="check-circle-bold"
                    size={14}
                    className="text-ng-leaf"
                  />
                  Plastic-free, recyclable packaging
                </li>
                <li className="flex items-center gap-2">
                  <Icon
                    name="check-circle-bold"
                    size={14}
                    className="text-ng-leaf"
                  />
                  Secure payments via {payment?.categoryLabel ?? "UPI, cards & wallets"}
                </li>
              </ul>
            </div>

            <Button variant="ghost" size="md" fullWidth asChild>
              <Link href="/cart">
                <Icon name="arrow-left-linear" size={16} />
                Back to bag
              </Link>
            </Button>
          </aside>
        </div>
      </Section>
    </PageShell>
  );
}
