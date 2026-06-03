"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { cn } from "@/lib/utils";
import type { Coupon } from "@/types/nutrigreenz";
import {
  COUPON_ERROR_MESSAGE,
  INR,
  POINTS_PER_RUPEE,
  validateCoupon,
} from "./order-math";

export function RewardsPanel({
  subtotal,
  coupons,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  loyaltyAvailable,
  loyaltyRedeemed,
  onToggleLoyalty,
}: {
  subtotal: number;
  coupons: Coupon[];
  appliedCoupon: { coupon: Coupon; discount: number } | null;
  onApplyCoupon: (coupon: Coupon, discount: number) => void;
  onRemoveCoupon: () => void;
  /** Balance in points available to redeem. */
  loyaltyAvailable: number;
  /** Points currently being redeemed (0 when off). */
  loyaltyRedeemed: number;
  onToggleLoyalty: (on: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const loyaltyRupees = Math.floor(loyaltyAvailable / POINTS_PER_RUPEE);
  const loyaltyOn = loyaltyRedeemed > 0;

  function handleApply() {
    const result = validateCoupon(code, subtotal, coupons);
    if (!result.ok || !result.coupon) {
      toast.error(
        result.error
          ? COUPON_ERROR_MESSAGE[result.error]
          : "That code isn't valid.",
      );
      return;
    }
    onApplyCoupon(result.coupon, result.discount);
    toast.success(`${result.coupon.code} applied — you saved ${INR(result.discount)}`);
    setCode("");
  }

  return (
    <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-ng-float)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-clay/25 text-ng-clay-deep">
          <Icon name="ticket-bold" size={20} />
        </span>
        <div className="flex flex-col">
          <span className="ng-eyebrow text-ng-forest/70">Step 3</span>
          <h2 className="font-display text-[24px] leading-tight text-ng-forest-deep">
            Coupons &amp; rewards
          </h2>
        </div>
      </div>

      {/* Coupon */}
      {appliedCoupon ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-ng-leaf bg-ng-sage/30 p-4">
          <div className="flex items-center gap-3">
            <Icon
              name="ticket-bold"
              size={20}
              className="text-ng-forest"
            />
            <div>
              <div className="font-display text-[15px] text-ng-forest-deep">
                {appliedCoupon.coupon.code}
                <span className="ml-2 text-[13px] font-medium text-ng-green-bright">
                  − {INR(appliedCoupon.discount)}
                </span>
              </div>
              <div className="text-[12px] text-ng-ink-muted">
                {appliedCoupon.coupon.description}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onRemoveCoupon();
              toast("Coupon removed");
            }}
            className="text-[13px] font-semibold text-ng-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Have a coupon code?"
              placeholder="e.g. FRESH50"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApply();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleApply}
            disabled={code.trim().length === 0}
            className="h-12"
          >
            Apply
          </Button>
        </div>
      )}

      {/* Loyalty redemption */}
      <div className="mt-5 border-t border-ng-line-soft pt-5">
        <button
          type="button"
          onClick={() => onToggleLoyalty(!loyaltyOn)}
          disabled={loyaltyRupees <= 0}
          aria-pressed={loyaltyOn}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
            loyaltyOn
              ? "border-ng-forest bg-ng-sage/30"
              : "border-ng-line-soft hover:border-ng-leaf",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ng-clay/30 text-ng-forest-deep">
              <Icon name="medal-ribbon-star-bold" size={20} />
            </span>
            <div>
              <div className="font-display text-[15px] text-ng-forest-deep">
                {loyaltyOn
                  ? `Redeeming ${loyaltyRedeemed} points (− ${INR(loyaltyRupees)})`
                  : `Redeem ${loyaltyAvailable} points (− ${INR(loyaltyRupees)})`}
              </div>
              <div className="text-[12px] text-ng-ink-muted">
                {loyaltyRupees > 0
                  ? `Available balance · ${loyaltyAvailable} pts · 10 pts = ₹1`
                  : "Earn points on every order to redeem later"}
              </div>
            </div>
          </div>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              loyaltyOn ? "bg-ng-forest" : "bg-ng-line",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-ng-paper transition-all",
                loyaltyOn ? "left-[22px]" : "left-0.5",
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
