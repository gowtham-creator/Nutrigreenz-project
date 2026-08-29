"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 * Shared contract — the receipt, invoice and success page depend on this shape.
 * `category` narrowed to the two methods actually offered; the wider union
 * (card / wallet / paylater / netbanking) described instruments that were never
 * chargeable, and the picker shipped with a hardcoded UPI id and two invented
 * saved cards ("Visa ····4242") shown to real customers.
 * ────────────────────────────────────────────────────────────────────────── */
export interface PaymentSelection {
  category: "upi" | "cod";
  id: string;
  label: string;
  categoryLabel: string;
  logo?: string;
}

export const UPI_SELECTION: PaymentSelection = {
  category: "upi",
  id: "upi",
  label: "UPI",
  categoryLabel: "UPI",
};

export const COD_SELECTION: PaymentSelection = {
  category: "cod",
  id: "cod",
  label: "Cash on Delivery",
  categoryLabel: "Cash on Delivery",
};

/** Server's answer on whether a gateway is actually wired and fully configured. */
async function fetchOnlineAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/payments/methods", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { methods?: string[] };
    return Array.isArray(data.methods) && data.methods.includes("upi");
  } catch {
    // Treat an unreachable check as "not available". Offering UPI and failing at
    // the redirect is worse than not offering it: by then the customer has
    // entered an address and believes the order is going through.
    return false;
  }
}

/**
 * Checkout payment method — UPI or Cash on Delivery.
 *
 * UPI is shown only when the server confirms a gateway is configured AND holds
 * every credential it needs. While SBIePay's integration kit is outstanding it
 * renders as visibly unavailable rather than as a button that fails, and the
 * order is never allowed to reach a "paid" state without a real charge.
 */
export function PaymentPicker({
  selected,
  onSelect,
}: {
  selected: PaymentSelection | null;
  onSelect: (p: PaymentSelection) => void;
}) {
  const [onlineAvailable, setOnlineAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchOnlineAvailable().then((ok) => {
      if (!alive) return;
      setOnlineAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Fall back to COD once we know UPI isn't on offer.
   *
   * The `!selected` guard this replaces only covered a FRESH checkout. Checkout
   * restores its draft from localStorage, so a returning customer arrived with
   * `selected` already set to UPI from a visit when it was offered — the guard
   * saw a selection, did nothing, and the UPI card rendered disabled while
   * remaining the chosen method. Place order then posted `upi` for a gateway
   * that isn't there, which is how NG-26-1005 … 1008 came to exist.
   *
   * Disabling a control is not the same as clearing what it selected, so this
   * now also displaces a stale UPI choice.
   */
  useEffect(() => {
    if (onlineAvailable !== false) return;
    if (!selected || selected.category === "upi") onSelect(COD_SELECTION);
  }, [onlineAvailable, selected, onSelect]);

  const upiChosen = selected?.category === "upi";
  const codChosen = selected?.category === "cod";

  return (
    <div className="space-y-3">
      {/* UPI */}
      <button
        type="button"
        disabled={onlineAvailable !== true}
        onClick={() => onSelect(UPI_SELECTION)}
        aria-pressed={upiChosen}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors",
          upiChosen
            ? "border-ng-forest bg-ng-sage/40 ring-1 ring-ng-forest"
            : "border-ng-line-soft bg-ng-paper hover:border-ng-leaf",
          onlineAvailable !== true && "cursor-not-allowed opacity-55 hover:border-ng-line-soft",
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ng-forest/10 text-ng-forest">
          <Icon name="smartphone-bold" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] leading-tight text-ng-forest-deep">
            Pay by UPI
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ng-ink-muted">
            {onlineAvailable === null
              ? "Checking availability…"
              : onlineAvailable
                ? "You'll be taken to the secure bank page to complete the payment."
                : "Temporarily unavailable. We're finishing our bank integration."}
          </span>
        </span>
        {upiChosen ? (
          <UiIcon name="verified" size={20} className="shrink-0 text-ng-forest" />
        ) : null}
      </button>

      {/* Cash on delivery */}
      <button
        type="button"
        onClick={() => onSelect(COD_SELECTION)}
        aria-pressed={codChosen}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors",
          codChosen
            ? "border-ng-forest bg-ng-sage/40 ring-1 ring-ng-forest"
            : "border-ng-line-soft bg-ng-paper hover:border-ng-leaf",
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ng-cream text-ng-clay-deep">
          <Icon name="wallet" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] leading-tight text-ng-forest-deep">
            Cash on Delivery
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ng-ink-muted">
            Pay the delivery partner when your harvest arrives.
          </span>
        </span>
        {codChosen ? (
          <UiIcon name="verified" size={20} className="shrink-0 text-ng-forest" />
        ) : null}
      </button>
    </div>
  );
}
