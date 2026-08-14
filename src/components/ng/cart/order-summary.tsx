"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { MagneticHover } from "@/components/ng/motion";
import { useCart } from "@/lib/cart";
import { useCommerceRules } from "@/lib/commerce";
import { computeShipping, computeTax } from "@/components/ng/checkout/order-math";
import { useAuth } from "@/lib/auth";

/**
 * Order summary card: subtotal, free-delivery progress, shipping, tax note, total,
 * minimum-order-value gating, the §3.9 no-cancellation acknowledgement, and the
 * checkout CTA (enabled only when MOV is met AND the acknowledgement is checked).
 */
export function OrderSummary() {
  const { subtotal } = useCart();
  const rules = useCommerceRules();
  const { minOrderValue, freeDeliveryThreshold, taxMode } = rules;
  const { isAuthed } = useAuth();
  // Pre-acknowledged by default (client request); shopper can still untick it.
  const [acknowledged, setAcknowledged] = useState(true);
  // Require sign-in BEFORE checkout so the order is tied to the account and the
  // customer's details/progress are saved against them. `next` returns them to
  // checkout right after they authenticate.
  const checkoutHref = isAuthed ? "/checkout" : "/auth?next=/checkout";

  const qualifiesFreeDelivery = subtotal >= freeDeliveryThreshold;
  // Honour the live shipping rule (flat / slab / zero) from the Super-Admin config.
  const shipping = computeShipping(subtotal, rules);
  // Cart has no coupon/loyalty yet, so the taxable base is the subtotal.
  const tax = computeTax(subtotal, rules);
  const total = subtotal + shipping + tax;

  const amountToFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);
  const freeDeliveryProgress = Math.min(100, (subtotal / freeDeliveryThreshold) * 100);

  const movMet = subtotal >= minOrderValue;
  const amountToMov = Math.max(0, minOrderValue - subtotal);
  const canCheckout = movMet && acknowledged;

  return (
    <aside className="self-start lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-paper shadow-[var(--shadow-ng-float)]">
        {/* Header band */}
        <div className="flex items-center gap-3 border-b border-ng-line-soft bg-ng-forest-deep px-6 py-5 sm:px-7">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
            <UiIcon name="order" size={18} />
          </span>
          <h2 className="font-display text-[20px] text-ng-cream">Order summary</h2>
        </div>

        <div className="p-6 sm:p-7">
          {/* Free-delivery progress */}
          <div
            className={
              "mb-5 rounded-2xl p-4 transition-colors " +
              (qualifiesFreeDelivery
                ? "bg-ng-leaf/15 ring-1 ring-ng-leaf/30"
                : "bg-ng-sage/30")
            }
          >
            {qualifiesFreeDelivery ? (
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ng-forest-deep">
                <Icon name="delivery-bold" size={18} className="text-ng-leaf" />
                You&apos;ve unlocked free delivery
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[14px] font-medium text-ng-forest-deep">
                <Icon name="delivery-linear" size={18} className="text-ng-clay-deep" />
                <span>
                  Add{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    ₹{amountToFreeDelivery.toLocaleString("en-IN")}
                  </span>{" "}
                  more for free delivery
                </span>
              </div>
            )}
            <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-ng-paper ring-1 ring-ng-line-soft">
              <div
                className="h-full rounded-full bg-ng-forest-deep transition-all duration-700 ease-out"
                style={{ width: `${freeDeliveryProgress}%` }}
              />
            </div>
          </div>

          {/* Totals */}
          <dl className="space-y-3 text-[14px]">
            <div className="flex items-center justify-between">
              <dt className="text-ng-ink-muted">Subtotal</dt>
              <dd className="font-mono font-medium tabular-nums text-ng-ink">
                ₹{subtotal.toLocaleString("en-IN")}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ng-ink-muted">Shipping</dt>
              <dd
                className={
                  shipping === 0
                    ? "font-semibold text-ng-leaf"
                    : "font-mono font-medium tabular-nums text-ng-ink"
                }
              >
                {shipping === 0 ? "Free" : `₹${shipping.toLocaleString("en-IN")}`}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ng-ink-muted">Tax</dt>
              {taxMode === "inclusive" ? (
                <dd className="text-[13px] text-ng-ink-soft">incl. GST</dd>
              ) : tax > 0 ? (
                <dd className="font-mono font-medium tabular-nums text-ng-ink">
                  ₹{tax.toLocaleString("en-IN")}
                </dd>
              ) : (
                <dd className="text-[13px] text-ng-ink-soft">added at checkout</dd>
              )}
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-ng-line-soft pt-4">
            <span className="font-display text-[18px] text-ng-forest-deep">Total</span>
            <span className="font-display text-[28px] tabular-nums text-ng-forest-deep">
              ₹{total.toLocaleString("en-IN")}
            </span>
          </div>

          {/* MOV gating notice */}
          {!movMet ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-ng-amber/40 bg-ng-amber/10 px-3.5 py-3 text-[13px] leading-relaxed text-ng-soil">
              <Icon name="cart-large-minimalistic-bold" size={16} className="mt-0.5 shrink-0 text-ng-clay-deep" />
              <span>
                Add{" "}
                <span className="font-mono font-semibold tabular-nums">
                  ₹{amountToMov.toLocaleString("en-IN")}
                </span>{" "}
                more to reach the{" "}
                <span className="font-mono tabular-nums">₹{minOrderValue.toLocaleString("en-IN")}</span>{" "}
                minimum order.
              </span>
            </p>
          ) : null}

          {/* No-cancellation disclosure (§3.9) + required acknowledgement */}
          <div className="mt-5 rounded-2xl border border-ng-line bg-ng-cream/60 p-4">
            <div className="flex items-start gap-2.5">
              <UiIcon name="caution" size={20} className="mt-0.5 shrink-0 text-ng-clay-deep" />
              <div>
                <p className="text-[13px] font-semibold text-ng-forest-deep">No cancellations</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ng-ink-muted">
                  We pick, pack and dispatch from the farm fast. Once an order is placed it cannot
                  be cancelled.
                </p>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-ng-ink">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ng-forest"
              />
              <span>I understand orders can&apos;t be cancelled once placed.</span>
            </label>
          </div>

          {/* Checkout CTA */}
          {canCheckout ? (
            <MagneticHover className="mt-5 block w-full">
              <Button variant="primary" size="lg" fullWidth asChild>
                <Link href={checkoutHref}>
                  {isAuthed ? (
                    <>
                      Proceed to checkout
                      <Icon name="arrow-right-linear" size={18} />
                    </>
                  ) : (
                    <>
                      <Icon name="lock-keyhole-minimalistic-bold" size={18} />
                      Sign in to checkout
                    </>
                  )}
                </Link>
              </Button>
            </MagneticHover>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              disabled
              aria-disabled="true"
            >
              Proceed to checkout
              <Icon name="arrow-right-linear" size={18} />
            </Button>
          )}

          {!canCheckout ? (
            <p className="mt-2.5 text-center text-[12px] text-ng-ink-soft">
              {!movMet
                ? `Reach the ₹${minOrderValue.toLocaleString("en-IN")} minimum to continue.`
                : "Acknowledge the no-cancellation notice to continue."}
            </p>
          ) : (
            <p className="mt-2.5 text-center text-[11px] text-ng-ink-soft">
              Secure payments · UPI · Cards · COD
            </p>
          )}

          {/* Reassurance row */}
          <ul className="mt-5 grid grid-cols-3 gap-2 border-t border-ng-line-soft pt-5 text-center">
            {[
              { icon: "lock" as const, label: "Secure payment" },
              { icon: "qr" as const, label: "Lot-traceable" },
              {
                icon: "delivery-bold",
                label: `Free over ₹${freeDeliveryThreshold.toLocaleString("en-IN")}`,
              },
            ].map((r) => (
              <li key={r.label} className="flex flex-col items-center gap-1.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ng-cream text-ng-forest">
                  <Icon name={r.icon} size={16} />
                </span>
                <span className="text-[11px] leading-tight text-ng-ink-muted">{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile/tablet persistent checkout bar — the summary above is only sticky
          at lg, so below it we pin the total + primary CTA to the viewport bottom
          so checkout is always reachable without scrolling past every line item. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ng-line-soft bg-ng-paper/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="min-w-0 shrink-0">
            <p className="text-[11px] leading-none text-ng-ink-soft">Total</p>
            <p className="mt-0.5 font-display text-[20px] leading-none tabular-nums text-ng-forest-deep">
              ₹{total.toLocaleString("en-IN")}
            </p>
          </div>
          {canCheckout ? (
            <Button variant="primary" size="lg" className="min-w-0 flex-1" asChild>
              <Link href={checkoutHref}>
                {isAuthed ? (
                  <>
                    <span className="truncate">Proceed to checkout</span>
                    <Icon name="arrow-right-linear" size={18} />
                  </>
                ) : (
                  <>
                    <Icon name="lock-keyhole-minimalistic-bold" size={18} />
                    <span className="truncate">Sign in to checkout</span>
                  </>
                )}
              </Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="min-w-0 flex-1"
              disabled
              aria-disabled="true"
            >
              <span className="truncate">Proceed to checkout</span>
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
