"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useFeatureFlag } from "@/components/ng/feature-gate";
import { SUBSCRIBER_DISCOUNT_BPS } from "@/lib/subscriptions-core";
import { cn } from "@/lib/utils";

/**
 * A quiet "you could subscribe to this" prompt for the bag and the order
 * confirmation. Hidden while subscriptions are switched off.
 */
export function SubscribeNudge({
  title,
  body,
  savingRupees,
  className,
}: {
  title: string;
  body: string;
  /** When given and positive, shown as the money the customer would save. */
  savingRupees?: number;
  className?: string;
}) {
  const on = useFeatureFlag("subscriptions");
  if (!on) return null;
  const percent = SUBSCRIBER_DISCOUNT_BPS / 100;
  return (
    <Link
      href="/subscriptions"
      className={cn(
        "group flex items-center gap-4 rounded-2xl border border-ng-leaf/40 bg-gradient-to-r from-ng-leaf/[0.09] to-ng-cream/60 px-4 py-4 transition-colors hover:border-ng-leaf sm:px-5",
        className,
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ng-forest text-ng-cream">
        <Icon name="refresh-bold" size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-ng-forest-deep">
          {title}
          {savingRupees && savingRupees > 0 ? (
            <span className="ml-1.5 rounded-full bg-ng-forest px-2 py-0.5 text-[11px] font-bold text-ng-cream tabular-nums">
              save ₹{Math.round(savingRupees).toLocaleString("en-IN")}
            </span>
          ) : (
            <span className="ml-1.5 rounded-full bg-ng-forest px-2 py-0.5 text-[11px] font-bold text-ng-cream">
              {percent}% off
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-ng-ink-muted">{body}</span>
      </span>
      <span aria-hidden className="text-[18px] text-ng-forest transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
