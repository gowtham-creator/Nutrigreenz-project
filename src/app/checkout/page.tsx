"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { useCommerceRules } from "@/lib/commerce";
import { useLoyaltyConfig } from "@/lib/loyalty-config";
import { useAddresses } from "@/lib/addresses";
import { fetchServiceable } from "@/lib/serviceability";
import { couponReasonMessage, fetchRewards } from "@/lib/rewards-client";
import type { CartItem, Coupon } from "@/types/nutrigreenz";
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
  INR,
  maxRedeemableRupees,
  pointsEarned,
} from "@/components/ng/checkout/order-math";
import { saveReceipt } from "@/components/ng/checkout/order-receipt";

const CHECKOUT_STEPS = [
  { label: "Address", icon: "location" },
  { label: "Slot", icon: "deliveryTime" },
  { label: "Rewards", icon: "coupon" },
  { label: "Payment", icon: "wallet" },
  { label: "Review", icon: "shield-check-bold" },
] as const;

/**
 * SBIePay's hosts: live and UAT, and subdomains of either bank domain.
 *
 * The payment URL comes from our own API, but it is where the customer is
 * about to type card or UPI details, so it is checked rather than trusted. A
 * misconfigured base URL, or anything that tampers with the response, must
 * not be able to send them to a look-alike page.
 */
const SBIEPAY_HOSTS = new Set(["sbiepay.sbi.bank.in", "integration.sbiepay.sbiuat.bank.in"]);
const SBIEPAY_PARENT_DOMAINS = [".sbi.bank.in", ".sbiuat.bank.in"];

function isSbiePayUrl(action: string): boolean {
  let url: URL;
  try {
    url = new URL(action);
  } catch {
    return false; // relative or malformed
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return SBIEPAY_HOSTS.has(host) || SBIEPAY_PARENT_DOMAINS.some((d) => host.endsWith(d));
}

/** The parts of a rejected order POST that checkout can act on. */
async function readRejection(
  res: Response,
): Promise<{ error?: string; reason?: string; variantIds?: string[]; titles?: string[] }> {
  try {
    const body = (await res.json()) as unknown;
    if (typeof body !== "object" || body === null) return {};
    const b = body as Record<string, unknown>;
    return {
      error: typeof b.error === "string" ? b.error : undefined,
      reason: typeof b.reason === "string" ? b.reason : undefined,
      variantIds: Array.isArray(b.variantIds)
        ? b.variantIds.filter((v): v is string => typeof v === "string")
        : undefined,
      titles: Array.isArray(b.titles)
        ? b.titles.filter((v): v is string => typeof v === "string")
        : undefined,
    };
  } catch {
    return {};
  }
}

/** "A2 Ghee is out of stock…", naming the cart lines the server refused. */
function outOfStockMessage(items: CartItem[], variantIds: string[] = []): string {
  const names = [
    ...new Set(
      items
        .filter((i) => i.variantId && variantIds.includes(i.variantId))
        .map((i) => (i.variantLabel ? `${i.title} (${i.variantLabel})` : i.title)),
    ),
  ];
  if (names.length === 0) {
    return "Some items in your bag just went out of stock. Please review your bag and try again.";
  }
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "is" : "are"} out of stock. Remove ${names.length === 1 ? "it" : "them"} or lower the quantity in your bag, then try again.`;
}

/**
 * Horizontal step indicator — and the navigation itself.
 *
 * The chips used to be decorative `<span>`s, so a shopper who wanted to change
 * an address entered three steps ago had to press Back repeatedly. They are now
 * buttons, but only as far as the form allows: a step is reachable when every
 * step before it is satisfied. Jumping to Review with no address would produce
 * an order that cannot be placed, and the shopper would only find out at the
 * final button.
 *
 * On desktop the whole form is visible at once, so the chips scroll to the
 * matching section rather than switching a wizard pane.
 */
function CheckoutStepper({
  current,
  onJump,
  canJumpTo,
}: {
  current: number;
  onJump: (index: number) => void;
  canJumpTo: (index: number) => boolean;
}) {
  return (
    <Reveal>
      <ol className="mb-8 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-ng-line-soft bg-ng-paper/70 p-2.5 backdrop-blur sm:gap-2 sm:p-3">
        {CHECKOUT_STEPS.map((step, i) => {
          // On mobile/tablet the chip reflects live progress (done/current vs
          // upcoming); on desktop (lg+) every chip reads as active since the
          // whole form is shown at once.
          const on = i <= current;
          const done = i < current;
          const reachable = canJumpTo(i);
          const isCurrent = i === current;
          return (
            <li key={step.label} className="flex flex-1 items-center gap-1.5 last:flex-none sm:flex-none sm:shrink-0 sm:gap-2">
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                // Says WHY it is locked. A disabled chip with no explanation
                // reads as broken rather than as "finish the step before it".
                title={
                  reachable
                    ? `Go to ${step.label}`
                    : `Finish the earlier steps to reach ${step.label}`
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors sm:px-3.5",
                  on ? "bg-ng-sage/50 text-ng-forest" : "bg-ng-sage/20 text-ng-ink-muted lg:bg-ng-sage/40 lg:text-ng-forest",
                  reachable
                    ? "cursor-pointer hover:bg-ng-sage/70"
                    : "cursor-not-allowed opacity-60",
                  isCurrent && "ring-1 ring-ng-forest/40",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold tabular-nums transition-colors",
                    on ? "bg-ng-forest text-ng-cream" : "bg-ng-line text-ng-ink-soft lg:bg-ng-forest lg:text-ng-cream",
                  )}
                >
                  {done ? <UiIcon name="verified" size={11} /> : i + 1}
                </span>
                <Icon name={step.icon} size={14} className="hidden text-ng-forest sm:inline" />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < CHECKOUT_STEPS.length - 1 ? (
                <span aria-hidden className={cn("h-px flex-1 sm:w-5 sm:flex-none", done ? "bg-ng-forest lg:bg-ng-line" : "bg-ng-line")} />
              ) : null}
            </li>
          );
        })}
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
  // Wizard position for the mobile/tablet stepped flow (ignored on desktop,
  // where the whole form renders at once). 0 = Address … 4 = Review.
  const [step, setStep] = useState(0);

  // Pressing Back on the bank's page can restore this page from the
  // back/forward cache exactly as it was left: mid-submit, button disabled on
  // "Placing order…", with nothing in flight any more. Without this the
  // customer is stuck until they reload.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPlacing(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

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

  /*
   * What each step needs before the shopper may move PAST it.
   *
   * Written per-step rather than only for the current one, so the stepper chips
   * can tell which steps are reachable. Jumping straight to Review without an
   * address would produce an order that cannot be placed, and the failure would
   * only surface at the very last button.
   */
  const stepSatisfied = useMemo(
    () => [
      Boolean(resolvedAddressId) && !notServiceable,
      Boolean(resolvedSlotId),
      true, // Rewards are optional.
      Boolean(payment),
      true, // Review has nothing after it.
    ],
    [resolvedAddressId, notServiceable, resolvedSlotId, payment],
  );

  // Mobile/tablet wizard gate: may the shopper advance from the current step?
  const stepReady = stepSatisfied[step] ?? true;

  /**
   * A step is reachable when every step before it is satisfied.
   *
   * Going back is always allowed — that is the whole point of a clickable
   * stepper, and revisiting a completed step cannot invalidate anything.
   */
  const canJumpTo = useCallback(
    (target: number) =>
      target <= step || stepSatisfied.slice(0, target).every(Boolean),
    [step, stepSatisfied],
  );

  /**
   * Move to a step from the stepper.
   *
   * Both layouts are handled because they are genuinely different: on
   * mobile/tablet the steps are wizard panes and only one is mounted visibly,
   * so this switches panes; on desktop every section is on screen at once, so
   * switching would do nothing visible and the chip has to scroll instead.
   *
   * `step` is still set on desktop — it drives the Review/summary column, so
   * leaving it behind would desync the two.
   */
  const jumpToStep = useCallback(
    (target: number) => {
      if (!canJumpTo(target)) return;
      setStep(target);
      if (typeof window === "undefined") return;
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (!isDesktop) return;
      // Let the pane state settle before measuring the scroll target.
      requestAnimationFrame(() => {
        document
          .getElementById(`ng-step-${target}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [canJumpTo],
  );

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
    // There is no order without that number: the success page looks it up.
    let orderNumber: string | null = null;
    // Where to send the customer to pay, when the order is paid online. Set only
    // from the server's response: SBI issues the link per order.
    let gateway: { action: string; fields: Record<string, string> } | null = null;
    const wantsOnline = payment?.category === "upi";
    const onlineFailed = () => {
      // An online order that never reached the gateway must NOT end on the
      // success page: the customer would believe they had paid. Keep the cart
      // so they can retry, or switch to Cash on Delivery.
      toast.error("We couldn't open the payment page. Please try again, or choose Cash on Delivery.");
      setPlacing(false);
    };
    const placeFailed = () => {
      // Same rule for Cash on Delivery: an order the server did not create must
      // not end on "Order confirmed". Keep the cart so they can try again.
      toast.error("We couldn't place your order. Please check your connection and try again.");
      setPlacing(false);
    };
    const failed = () => (wantsOnline ? onlineFailed() : placeFailed());
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
          paymentMethod: payment?.category === "upi" ? "upi" : "cod",
          addressSnapshot: selectedAddress,
          slotSnapshot: selectedSlot,
          userEmail: account?.email ?? null,
          userPhone: account?.phone ?? null,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          orderNumber?: string;
          payment?: { action?: string; fields?: Record<string, string> } | null;
        };
        if (data?.orderNumber) orderNumber = data.orderNumber;
        if (data?.payment?.action) {
          gateway = { action: data.payment.action, fields: data.payment.fields ?? {} };
        }
      } else if (res.status === 401) {
        // Session expired between gate and submit — send them to re-auth.
        toast.error("Please sign in again to place your order.");
        setPlacing(false);
        router.replace("/auth?next=/checkout");
        return;
      } else {
        // Rejected before anything was created or charged. Two of these the
        // customer can fix from here, so say exactly what; anything else is a
        // plain failure. Never the success page, whatever the method.
        const rejection = await readRejection(res);
        if (res.status === 409 && rejection.error === "item-unavailable") {
          const names = (rejection.titles ?? []).filter(Boolean);
          toast.error(
            `${names.length ? names.join(", ") : "Some items"} in your cart ${names.length === 1 ? "is" : "are"} no longer available. Please remove ${names.length === 1 ? "it" : "them"} from your cart and add ${names.length === 1 ? "it" : "them"} again from the shop.`,
          );
          setPlacing(false);
          return;
        }
        if (res.status === 409 && rejection.error === "out-of-stock") {
          toast.error(outOfStockMessage(items, rejection.variantIds));
          setPlacing(false);
          return;
        }
        if (res.status === 400 && rejection.error === "coupon-invalid") {
          const code = applied?.coupon.code;
          const why = couponReasonMessage(rejection.reason ?? "");
          toast.error(
            `${code ? `We removed coupon ${code}` : "We removed your coupon"}. ${why} Check your new total and place the order again.`,
          );
          setApplied(null);
          setPlacing(false);
          return;
        }
        failed();
        return;
      }
    } catch {
      // Network error: nothing confirms the order exists.
      failed();
      return;
    }

    if (!orderNumber) {
      failed();
      return;
    }

    // The order exists but no payment link came back: the gateway refused it.
    if (wantsOnline && !gateway) {
      onlineFailed();
      return;
    }

    // The customer is about to hand card or UPI details to whatever this URL
    // points at. Only SBIePay is ever acceptable, whatever the response says.
    if (gateway && !isSbiePayUrl(gateway.action)) {
      onlineFailed();
      return;
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

    if (gateway) {
      // Hand off to SBI's payment page. The cart AND the checkout draft are
      // kept until payment is confirmed: SBI returns the customer to the
      // callback, which lands on /checkout/success (that page clears both once
      // the server says paid) or /checkout/failed (whose "Try again" needs the
      // cart and selections intact). Back from the bank lands here, filled in.
      if (Object.keys(gateway.fields).length === 0) {
        window.location.assign(gateway.action);
      } else {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = gateway.action;
        for (const [name, value] of Object.entries(gateway.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      }
      return;
    }

    // Cash on Delivery: the server created it, so it is placed.
    clearCheckoutDraft();
    clear();
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
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
                <Icon name="lock-keyhole-minimalistic-bold" size={28} />
              </span>
              <h1 className="mt-6 font-display text-[26px] text-ng-forest-deep">
                {authLoading ? "One moment…" : "Please sign in to continue"}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ng-ink-muted">
                {authLoading
                  ? "Checking your session."
                  : "Sign in so your order, address and details are saved to your account. Then you'll come straight back to checkout."}
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
                  <span className="grid h-24 w-24 place-items-center rounded-full bg-ng-cream text-ng-forest-deep ring-8 ring-ng-sage/20">
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
                    <UiIcon name="bag" size={18} />
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
        <CheckoutStepper current={step} onJump={jumpToStep} canJumpTo={canJumpTo} />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_400px]">
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
                  <UiIcon name="caution" size={20} />
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
                  <UiIcon name="location" size={20} />
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

            <StaggerItem id="ng-step-0" className={cn(step !== 0 && "hidden", "lg:block", "scroll-mt-28")}>
              <AddressPicker
                addresses={addresses}
                selectedId={resolvedAddressId}
                onSelect={setAddressId}
              />
            </StaggerItem>

            <StaggerItem id="ng-step-1" className={cn(step !== 1 && "hidden", "lg:block", "scroll-mt-28")}>
              <SlotPicker
                slots={rules.deliverySlots}
                selectedId={resolvedSlotId}
                onSelect={setSlotId}
              />
            </StaggerItem>

            <StaggerItem id="ng-step-2" className={cn(step !== 2 && "hidden", "lg:block", "scroll-mt-28")}>
              <RewardsPanel
                subtotal={subtotal}
                deliveryPincode={selectedPincode}
                appliedCoupon={applied}
                // Product-targeted coupons reject when the cart context is
                // missing, so the quote needs the cart's product ids.
                cartProductIds={items.map((i) => i.productId)}
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

            <StaggerItem id="ng-step-3" className={cn(step !== 3 && "hidden", "lg:block", "scroll-mt-28")}>
              <PaymentPicker selected={payment} onSelect={setPayment} />
            </StaggerItem>

            <StaggerItem id="ng-step-4" className={cn(step !== 4 && "hidden", "lg:block", "scroll-mt-28")}>
              <NoCancellationAck
                checked={acknowledged}
                onChange={setAcknowledged}
              />
            </StaggerItem>
          </Stagger>

          {/* Mobile / tablet wizard nav — hidden on desktop (whole form shown). */}
          <div className="flex items-center gap-3 lg:hidden">
            {step > 0 ? (
              <Button variant="secondary" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                <Icon name="alt-arrow-left-linear" size={18} />
                Back
              </Button>
            ) : null}
            {step < CHECKOUT_STEPS.length - 1 ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!stepReady}
                onClick={() => setStep((s) => Math.min(CHECKOUT_STEPS.length - 1, s + 1))}
              >
                Next
                <Icon name="alt-arrow-right-linear" size={18} />
              </Button>
            ) : null}
          </div>

          {/* Right column — summary + CTA */}
          <aside className={cn(step !== CHECKOUT_STEPS.length - 1 && "hidden", "space-y-5 lg:block lg:sticky lg:top-24 lg:self-start")}>
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
                  <UiIcon
                    name="verified"
                    size={14}
                    className="text-ng-leaf"
                  />
                  Lot codes printed on every label
                </li>
                <li className="flex items-center gap-2">
                  <UiIcon
                    name="verified"
                    size={14}
                    className="text-ng-leaf"
                  />
                  Plastic-free, recyclable packaging
                </li>
                <li className="flex items-center gap-2">
                  <UiIcon
                    name="verified"
                    size={14}
                    className="text-ng-leaf"
                  />
                  Secure payments via {payment?.categoryLabel ?? "UPI or Cash on Delivery"}
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
