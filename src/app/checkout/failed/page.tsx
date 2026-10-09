"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { AppIcon } from "@/components/ui/app-icon";
import { FloatIn, Reveal } from "@/components/ng/motion";

/**
 * Where a customer lands when a payment does not complete.
 *
 * This page did not exist. The callback has always redirected here on failure,
 * so anyone whose payment declined — or who simply closed the bank's page — got
 * a bare "404 This page could not be found" with no explanation and no way
 * back. That is the worst possible moment to show someone a broken link: they
 * have just tried to give us money and cannot tell whether it was taken.
 *
 * The page therefore has to answer, in order:
 *   1. has my money gone?
 *   2. what do I do now?
 *   3. who do I talk to if this is wrong?
 */

/*
 * Say only what we know.
 *
 * Some customers arrive here with the money already taken: the bank could not
 * be asked, or had not finished. This page used to tell them it "will be
 * returned by your bank" or "returned automatically", which we cannot know, and
 * offered "Try again", which is how one order gets paid for twice. Where the
 * payment may have gone through, the page says so and offers no retry.
 */

interface Reason {
  title: string;
  detail: string;
  /** Offer "Try again". Only when we know no money was taken for this order. */
  retry: boolean;
  /** Point to the orders page, where a late confirmation will show up. */
  orders?: boolean;
}

/** The bank's final word was no. Safe to try again. */
const DECLINED: Reason = {
  title: "Your payment was declined",
  detail:
    "Your bank did not approve the payment, so your order has not been placed. This is usually a daily limit or a card restriction. Trying a different method often works.",
  retry: true,
};

/** We could not get, or match, the bank's answer. The money may be taken. */
const UNCONFIRMED: Reason = {
  title: "We couldn't confirm your payment yet",
  detail: "If money left your account, don't pay again; we'll confirm it shortly and email you.",
  retry: false,
  orders: true,
};

/** Plain-English cause, from the reason the callback attached. */
const REASONS = new Map<string, Reason>([
  ["declined", DECLINED],
  // SBI's own words for a final decline, passed through by the callback.
  ["failed", DECLINED],
  ["attempt_fail", DECLINED],
  [
    "cancel",
    {
      title: "Payment cancelled",
      detail: "You cancelled before the payment completed, so your order has not been placed.",
      retry: true,
    },
  ],
  [
    "expired",
    {
      title: "The payment link expired",
      detail:
        "Payment links stay valid for a short time for security, so your order has not been placed. Start again and you will get a fresh one.",
      retry: true,
    },
  ],
  ["pending", UNCONFIRMED],
  ["unconfirmed", UNCONFIRMED],
  // What the callback sends today when the bank had no matching record yet,
  // or answered for a different order. The order is left pending for the
  // reconcile sweep, so the money may well have been taken.
  ["not-found", UNCONFIRMED],
  ["reference-mismatch", UNCONFIRMED],
  [
    "amount-mismatch",
    {
      title: "We could not confirm the amount",
      detail:
        "The amount the bank reported does not match your order, so we have not marked it paid. Please don't pay again. Contact us with your bank reference and we'll sort it out with you.",
      retry: false,
    },
  ],
  [
    "unknown-order",
    {
      title: "We could not find that order",
      detail:
        "The payment came back referring to an order we do not recognise. If money has left your account, contact us with your bank reference and we will trace it.",
      retry: false,
    },
  ],
  [
    "no-reference",
    {
      title: "We could not identify your payment",
      detail:
        "The gateway did not tell us which order this payment was for. If money has left your account, please contact us with your bank reference. Do not pay again until we have checked.",
      retry: false,
    },
  ],
  [
    "unavailable",
    {
      title: "Online payment is unavailable",
      detail:
        "Online payment is temporarily unavailable, so nothing was charged. You can still place your order with cash on delivery.",
      retry: true,
    },
  ],
]);

/**
 * Any other reason, or none. The raw value is never shown: it comes from the
 * URL, so anyone can put words on our page by sending a crafted link.
 */
const FALLBACK: Reason = {
  title: "Your payment did not complete",
  detail:
    "Your order has not been placed. If money has left your account, contact us with your bank reference before paying again and we'll check it for you.",
  retry: true,
};

/** Server-issued order numbers look like NG-26-1042; anything else is not shown. */
const ORDER_NUMBER = /^NG-\d{2}-\d{4,}$/;

function FailedContent() {
  const params = useSearchParams();
  const rawOrder = params.get("order") ?? "";
  const orderNumber = ORDER_NUMBER.test(rawOrder) ? rawOrder : null;
  const info = REASONS.get(params.get("reason") ?? "") ?? FALLBACK;

  return (
    <Section className="py-14 sm:py-20">
      <div className="mx-auto max-w-xl">
        <FloatIn>
          <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ng-clay/[0.10] text-ng-clay-deep">
              <UiIcon name="caution" size={24} />
            </span>

            <h1 className="mt-4 text-[22px] font-semibold leading-tight text-ng-forest-deep sm:text-[26px]">
              {info.title}
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-ng-ink-muted">
              {info.detail}
            </p>

            {orderNumber ? (
              <p className="mt-4 rounded-xl bg-ng-sage/25 px-3.5 py-2.5 text-[13px] text-ng-forest-deep">
                Order reference{" "}
                <span className="select-all font-mono font-semibold">{orderNumber}</span>
              </p>
            ) : null}

            <Reveal>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                {info.retry ? (
                  <Button asChild variant="primary" size="lg">
                    <Link href="/checkout">
                      <Icon name="refresh-bold" size={18} />
                      Try again
                    </Link>
                  </Button>
                ) : null}
                {info.orders ? (
                  <Button asChild variant="primary" size="lg">
                    <Link href="/account/orders">
                      <Icon name="bill-check-bold" size={18} />
                      View my orders
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="secondary" size="lg">
                  <Link href="/contact">
                    <AppIcon name="message" size={18} />
                    Contact support
                  </Link>
                </Button>
                {info.retry ? (
                  <Button asChild variant="ghost" size="lg">
                    <Link href="/shop">Keep shopping</Link>
                  </Button>
                ) : null}
              </div>
            </Reveal>

            {/*
              Said plainly, and only what we know. Somebody reading this page
              is worried about their money; a promise about their bank we
              cannot keep is worse than telling them what to do next.
            */}
            <p className="mt-6 border-t border-ng-line-soft pt-4 text-[12.5px] leading-relaxed text-ng-ink-soft">
              Your order is only placed once payment is confirmed. If your bank
              shows a charge for an order that was not placed, don&apos;t pay
              again. Contact us with your bank reference and we&apos;ll find out
              what happened and sort it out with you.
            </p>
          </div>
        </FloatIn>
      </div>
    </Section>
  );
}

export default function CheckoutFailedPage() {
  return (
    <PageShell>
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={<div className="py-14 sm:py-20" />}>
        <FailedContent />
      </Suspense>
    </PageShell>
  );
}
