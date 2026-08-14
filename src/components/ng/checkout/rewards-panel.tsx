"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { cn } from "@/lib/utils";
import type { Coupon } from "@/types/nutrigreenz";
import { INR, POINTS_PER_RUPEE } from "./order-math";
import { couponReasonMessage, validateCouponApi } from "@/lib/rewards-client";
import {
  PHONE_VERIFIED_EVENT,
  requestPhoneVerification,
} from "@/lib/phone-verify-client";

/** One code the server says this customer could use. */
interface OfferedCoupon {
  code: string;
  kind: "percent" | "flat";
  value: number;
  minOrderPaise: number;
  capPaise: number | null;
  endsAt: string | null;
  discountPaise: number;
  /** Set on "almost there" entries: paise still needed to qualify. */
  shortfallPaise?: number;
}

/** "20% off, up to ₹150" — what the code does, before it is applied. */
function offerLabel(c: OfferedCoupon): string {
  const base =
    c.kind === "percent" ? `${c.value}% off` : `${INR(Math.round(c.value / 100))} off`;
  const cap = c.kind === "percent" && c.capPaise ? `, up to ${INR(Math.round(c.capPaise / 100))}` : "";
  return `${base}${cap}`;
}

export function RewardsPanel({
  subtotal,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  loyaltyAvailable,
  loyaltyRedeemed,
  onToggleLoyalty,
  redeemPointsPerRupee = POINTS_PER_RUPEE,
  deliveryPincode,
  cartProductIds,
}: {
  subtotal: number;
  appliedCoupon: { coupon: Coupon; discount: number } | null;
  onApplyCoupon: (coupon: Coupon, discount: number) => void;
  onRemoveCoupon: () => void;
  /** Balance in points available to redeem. */
  loyaltyAvailable: number;
  /** Points currently being redeemed (0 when off). */
  loyaltyRedeemed: number;
  onToggleLoyalty: (on: boolean) => void;
  /** Admin-configured points→₹ ratio, so the copy matches the real discount. */
  redeemPointsPerRupee?: number;
  /**
   * Pincode of the selected delivery address. Sent with the coupon quote so
   * area-targeted codes (specific pincodes / gated communities) resolve
   * correctly in the preview; the order path re-checks it authoritatively.
   */
  deliveryPincode?: string | null;
  /**
   * Product ids in the cart. Required for product-targeted coupons — those
   * reject rather than fall through when the cart context is missing, so
   * without this a product-targeted code can never be applied.
   */
  cartProductIds?: readonly (string | null | undefined)[];
}) {
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [offers, setOffers] = useState<{
    eligible: OfferedCoupon[];
    almostThere: OfferedCoupon[];
  } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const ratio = redeemPointsPerRupee > 0 ? redeemPointsPerRupee : POINTS_PER_RUPEE;
  const loyaltyRupees = Math.floor(loyaltyAvailable / ratio);
  const loyaltyOn = loyaltyRedeemed > 0;

  // A welcome / first-order code needs an OTP-verified phone before it validates.
  // When one is rejected for that reason we open the inline OTP prompt and, once
  // the customer verifies, re-apply the SAME code automatically (no re-typing).
  const pendingVerifyRef = useRef(false);
  const applyRef = useRef<() => void>(() => {});

  async function handleApply(override?: string) {
    if (applying) return;
    const target = override ?? code;
    setApplying(true);
    try {
      // Server-validated against the live coupon catalogue (the authoritative
      // charge is re-checked again when the order is actually placed).
      const result = await validateCouponApi(
        target,
        Math.round(subtotal * 100),
        deliveryPincode,
        cartProductIds,
      );
      if (!result.valid || !result.code) {
        toast.error(couponReasonMessage(result.reason));
        // Welcome/first-order code without a verified phone → open OTP inline and
        // remember to retry this code the moment verification completes.
        if (result.reason === "phone-verification-required") {
          pendingVerifyRef.current = true;
          requestPhoneVerification();
        }
        return;
      }
      const discount = Math.round(result.discountPaise) / 100;
      // A lightweight Coupon shape for display; the code is what the order path
      // re-validates, so the synthesized fields are presentational only.
      const coupon: Coupon = {
        code: result.code,
        description: `Applied, you saved ${INR(discount)}`,
        type: "flat",
        value: discount,
        active: true,
      };
      onApplyCoupon(coupon, discount);
      toast.success(`${result.code} applied, you saved ${INR(discount)}`);
      setCode("");
      pendingVerifyRef.current = false;
    } finally {
      setApplying(false);
    }
  }

  // Keep a live handle to the latest apply routine so the (stable) verified-phone
  // listener always retries with the current code/subtotal, never a stale closure.
  useEffect(() => {
    applyRef.current = () => void handleApply();
  });

  // When the OTP prompt reports a freshly-verified phone, retry the pending code.
  useEffect(() => {
    const onVerified = () => {
      if (!pendingVerifyRef.current) return;
      pendingVerifyRef.current = false;
      applyRef.current();
    };
    window.addEventListener(PHONE_VERIFIED_EVENT, onVerified);
    return () => window.removeEventListener(PHONE_VERIFIED_EVENT, onVerified);
  }, []);

  /*
   * Load the codes this customer could actually use.
   *
   * Every entry has already been run through the same validator that authorises
   * the discount, so the list cannot offer something the Apply button refuses.
   * That is why it re-runs when the subtotal, pincode or cart changes: an offer
   * quoted against a different cart would be exactly the false promise this is
   * meant to remove.
   *
   * A failure leaves the section hidden rather than showing an error. This is a
   * discovery aid on top of a working code box — nothing is lost if it is absent,
   * and an error banner here would read as "your coupon is broken".
   */
  const pids = (cartProductIds ?? []).filter(Boolean).join(",");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/rewards/available-coupons", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            subtotalPaise: Math.round(subtotal * 100),
            pincode: deliveryPincode?.trim() || null,
            productIds: pids ? pids.split(",") : [],
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          eligible?: OfferedCoupon[];
          almostThere?: OfferedCoupon[];
        };
        if (alive) {
          setOffers({ eligible: data.eligible ?? [], almostThere: data.almostThere ?? [] });
        }
      } catch {
        if (alive) setOffers(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [subtotal, deliveryPincode, pids]);

  // Two is enough to browse; the rest are behind "See all".
  const visibleEligible = offers
    ? showAll
      ? offers.eligible
      : offers.eligible.slice(0, 2)
    : [];
  const hiddenCount = offers ? offers.eligible.length - visibleEligible.length : 0;
  const bestSaving = offers?.eligible[0]?.discountPaise ?? 0;

  return (
    <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-ng-float)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-cream text-ng-clay-deep">
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
        <>
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
                    void handleApply();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => void handleApply()}
              disabled={code.trim().length === 0 || applying}
              className="h-12"
            >
              {applying ? "Checking…" : "Apply"}
            </Button>
          </div>

          {/*
            Offers this customer can actually use. Hidden entirely when there
            are none — an empty "Available offers" heading reads as something
            broken, where no heading reads as nothing on offer today.
          */}
          {offers && (offers.eligible.length > 0 || offers.almostThere.length > 0) ? (
            <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="text-[12.5px] font-semibold text-ng-forest-deep">
                  Offers for you
                </span>
                {bestSaving > 0 ? (
                  <span className="text-[12px] font-semibold text-ng-green-bright">
                    Save up to {INR(Math.round(bestSaving / 100))}
                  </span>
                ) : null}
              </div>

              <ul className="flex flex-col gap-2">
                {visibleEligible.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => void handleApply(c.code)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-ng-leaf bg-ng-sage/15 p-3.5 text-left transition-colors hover:bg-ng-sage/35 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ng-paper text-ng-forest">
                        <Icon name="ticket-bold" size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[13px] font-bold text-ng-forest-deep">
                          {c.code}
                        </span>
                        <span className="block text-[12px] text-ng-ink-muted">
                          {offerLabel(c)}
                          {c.endsAt
                            ? ` · till ${new Date(c.endsAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[13px] font-bold text-ng-green-bright">
                          − {INR(Math.round(c.discountPaise / 100))}
                        </span>
                        <span className="block text-[11px] font-semibold text-ng-forest underline-offset-2 group-hover:underline">
                          {applying ? "…" : "Apply"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}

                {/*
                  Codes blocked only by the minimum order. This is the one
                  rejection a customer can act on from here, so it is the only
                  one shown — "add ₹150 more" is useful; "not valid in your
                  area" is just a dead row.
                */}
                {offers.almostThere.slice(0, showAll ? undefined : 1).map((c) => (
                  <li
                    key={c.code}
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-ng-line bg-ng-cream/40 p-3.5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ng-paper text-ng-ink-soft">
                      <Icon name="ticket-bold" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-bold text-ng-ink-muted">
                        {c.code}
                      </span>
                      <span className="block text-[12px] text-ng-ink-muted">
                        Add {INR(Math.ceil((c.shortfallPaise ?? 0) / 100))} more to save{" "}
                        {INR(Math.round(c.discountPaise / 100))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {hiddenCount > 0 || (!showAll && offers.almostThere.length > 1) ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-2.5 text-[12.5px] font-semibold text-ng-forest hover:underline"
                >
                  See all offers
                </button>
              ) : null}
            </div>
          ) : null}
        </>
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
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
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
                  ? `Available balance · ${loyaltyAvailable} pts · ${ratio} pts = ₹1`
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
