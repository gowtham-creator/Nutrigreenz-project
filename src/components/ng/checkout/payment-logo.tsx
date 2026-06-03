"use client";

/**
 * <PaymentLogo provider="..." /> — renders a real Iconify brand logo where one
 * exists in the offline `logos` / `simple-icons` collections, and falls back to
 * a clean branded chip (brand-colour square + short label) for everything else.
 *
 * Brand collections are registered OFFLINE via `addCollection` so logos render
 * deterministically with no network round-trip and never flash an empty box.
 */

import { Icon as Iconify, addCollection } from "@iconify/react";
import logosCollection from "@iconify-json/logos/icons.json";
import simpleCollection from "@iconify-json/simple-icons/icons.json";
import { cn } from "@/lib/utils";

// Register once at module load (idempotent — re-registering is harmless).
type IconifyJSON = Parameters<typeof addCollection>[0];
addCollection(logosCollection as IconifyJSON);
addCollection(simpleCollection as IconifyJSON);

type LogoKind =
  | { type: "logo"; icon: string } // full-colour logo, render as-is
  | { type: "glyph"; icon: string; color: string } // monochrome glyph, tint with brand colour
  | { type: "chip"; label: string; bg: string; fg: string }; // text chip fallback

/**
 * Curated provider → render map. Verified against the installed collections:
 * `logos:` (full colour) and `simple-icons:` (monochrome glyphs).
 */
const PROVIDERS: Record<string, LogoKind> = {
  /* ── UPI apps ──────────────────────────────────────────────── */
  gpay: { type: "logo", icon: "logos:google-pay" },
  "google-pay": { type: "logo", icon: "logos:google-pay" },
  phonepe: { type: "glyph", icon: "simple-icons:phonepe", color: "#5F259F" },
  paytm: { type: "glyph", icon: "simple-icons:paytm", color: "#00BAF2" },
  bhim: { type: "chip", label: "BHIM", bg: "#0B7DA6", fg: "#FFFFFF" },
  cred: { type: "chip", label: "CRED", bg: "#0A0A0A", fg: "#FFFFFF" },
  upi: { type: "chip", label: "UPI", bg: "#0F7C4D", fg: "#FFFFFF" },

  /* ── Card networks ─────────────────────────────────────────── */
  visa: { type: "logo", icon: "logos:visa" },
  mastercard: { type: "logo", icon: "logos:mastercard" },
  maestro: { type: "logo", icon: "logos:maestro" },
  rupay: { type: "chip", label: "RuPay", bg: "#097DC6", fg: "#FFFFFF" },
  amex: { type: "logo", icon: "logos:amex" },
  unionpay: { type: "logo", icon: "logos:unionpay" },

  /* ── Wallets ───────────────────────────────────────────────── */
  amazonpay: { type: "glyph", icon: "simple-icons:amazonpay", color: "#FF9900" },
  "paytm-wallet": { type: "glyph", icon: "simple-icons:paytm", color: "#00BAF2" },
  mobikwik: { type: "chip", label: "MobiKwik", bg: "#2D2E82", fg: "#FFFFFF" },
  "phonepe-wallet": {
    type: "glyph",
    icon: "simple-icons:phonepe",
    color: "#5F259F",
  },
  freecharge: { type: "chip", label: "Freecharge", bg: "#F7941E", fg: "#FFFFFF" },

  /* ── Pay Later ─────────────────────────────────────────────── */
  lazypay: { type: "chip", label: "LazyPay", bg: "#11103E", fg: "#FFD200" },
  "amazon-paylater": {
    type: "glyph",
    icon: "simple-icons:amazonpay",
    color: "#FF9900",
  },
  simpl: { type: "chip", label: "Simpl", bg: "#4A37C9", fg: "#FFFFFF" },
  zestmoney: { type: "logo", icon: "logos:zest" },
  flipkart: { type: "glyph", icon: "simple-icons:flipkart", color: "#2874F0" },
  "flipkart-paylater": {
    type: "glyph",
    icon: "simple-icons:flipkart",
    color: "#2874F0",
  },

  /* ── Banks (netbanking) ────────────────────────────────────── */
  hdfc: { type: "glyph", icon: "simple-icons:hdfcbank", color: "#004C8F" },
  icici: { type: "glyph", icon: "simple-icons:icicibank", color: "#AE282E" },
  sbi: { type: "chip", label: "SBI", bg: "#22409A", fg: "#FFFFFF" },
  axis: { type: "glyph", icon: "simple-icons:axisbank", color: "#97144D" },
  kotak: { type: "chip", label: "Kotak", bg: "#003E7E", fg: "#FFFFFF" },

  /* ── Misc ──────────────────────────────────────────────────── */
  cod: { type: "chip", label: "₹", bg: "#1F4D2E", fg: "#FFFFFF" },
  netbanking: { type: "chip", label: "NB", bg: "#1F4D2E", fg: "#FFFFFF" },
};

export interface PaymentLogoProps {
  provider?: string;
  /** Square size of the logo tile in px. Defaults to 40. */
  size?: number;
  className?: string;
}

export function PaymentLogo({ provider, size = 40, className }: PaymentLogoProps) {
  const key = (provider ?? "").toLowerCase();
  const entry = PROVIDERS[key] ?? {
    type: "chip" as const,
    label: (provider ?? "?").slice(0, 2).toUpperCase(),
    bg: "#1F4D2E",
    fg: "#FFFFFF",
  };

  const tile =
    "grid place-items-center rounded-xl bg-white ring-1 ring-ng-line-soft overflow-hidden";

  if (entry.type === "logo") {
    return (
      <span
        className={cn(tile, className)}
        style={{ width: size, height: size }}
      >
        <Iconify
          icon={entry.icon}
          width={Math.round(size * 0.66)}
          height={Math.round(size * 0.66)}
          aria-hidden
        />
      </span>
    );
  }

  if (entry.type === "glyph") {
    return (
      <span
        className={cn(tile, className)}
        style={{ width: size, height: size }}
      >
        <Iconify
          icon={entry.icon}
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          color={entry.color}
          aria-hidden
        />
      </span>
    );
  }

  // Branded wordmark chip — the brand name set in clean condensed type on the
  // brand colour. Type is auto-fitted to the chip width so longer wordmarks
  // (e.g. "Freecharge", "MobiKwik") stay legible and never overflow.
  const len = entry.label.length;
  const fontSize =
    len <= 1
      ? size * 0.46 // single glyph e.g. "₹"
      : len <= 3
        ? size * 0.3 // SBI / NB / CRED-ish
        : Math.max(7, Math.min(size * 0.24, (size * 1.55) / len));
  return (
    <span
      className={cn(
        "grid place-items-center overflow-hidden rounded-xl px-1 text-center font-semibold uppercase leading-none tracking-tight",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: entry.bg,
        color: entry.fg,
        fontSize,
        fontFamily: "var(--font-sans)",
        fontStretch: "condensed",
        letterSpacing: "-0.01em",
      }}
      aria-hidden
    >
      {entry.label}
    </span>
  );
}

export default PaymentLogo;
