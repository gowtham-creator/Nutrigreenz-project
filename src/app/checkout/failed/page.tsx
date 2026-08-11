"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
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

/** Plain-English cause, from the reason the callback attached. */
const REASONS: Record<string, { title: string; detail: string; retry: boolean }> = {
  declined: {
    title: "Your payment was declined",
    detail:
      "Your bank did not approve the payment. Nothing has been charged. This is usually a daily limit or a card restriction — trying a different method often works.",
    retry: true,
  },
  cancel: {
    title: "Payment cancelled",
    detail: "You cancelled before the payment completed, so nothing was charged.",
    retry: true,
  },
  expired: {
    title: "The payment link expired",
    detail:
      "Payment links stay valid for a short time for security. Nothing was charged — start again and you will get a fresh one.",
    retry: true,
  },
  "amount-mismatch": {
    title: "We could not confirm the amount",
    detail:
      "The amount the bank reported does not match your order, so we have not marked it paid. If money has left your account, it will be returned automatically. Please contact us before paying again.",
    retry: false,
  },
  "unknown-order": {
    title: "We could not find that order",
    detail:
      "The payment came back referring to an order we do not recognise. If money has left your account, contact us with your bank reference and we will trace it.",
    retry: false,
  },
  "no-reference": {
    title: "We could not identify your payment",
    detail:
      "The gateway did not tell us which order this payment was for. If money has left your account, please contact us with your bank reference — do not pay again until we have checked.",
    retry: false,
  },
  unavailable: {
    title: "Online payment is unavailable",
    detail:
      "Card and net-banking payments are temporarily unavailable. Nothing was charged. You can still place your order with cash on delivery.",
    retry: true,
  },
};

const FALLBACK = {
  title: "Your payment did not complete",
  detail:
    "The payment was not completed, so your order has not been placed. If money has left your account it will be returned by your bank, usually within 5 working days.",
  retry: true,
};

function FailedContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order");
  const reason = params.get("reason") ?? "";
  const info = REASONS[reason] ?? FALLBACK;

  return (
    <Section className="py-14 sm:py-20">
      <div className="mx-auto max-w-xl">
        <FloatIn>
          <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ng-clay/[0.10] text-ng-clay-deep">
              <Icon name="danger-triangle-bold" size={24} />
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
              Said plainly and without hedging. Somebody reading this page is
              worried about their money, and "please contact us" alone does not
              answer the question they actually have.
            */}
            <p className="mt-6 border-t border-ng-line-soft pt-4 text-[12.5px] leading-relaxed text-ng-ink-soft">
              Your order is only placed once payment is confirmed. If your bank
              shows a charge for an order that was not placed, it is an
              authorisation hold and your bank releases it — normally within 5
              working days. Contact us with your bank reference and we will chase
              it for you.
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
