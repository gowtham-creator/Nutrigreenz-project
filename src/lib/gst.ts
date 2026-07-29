import "server-only";
import type { OrderWithDetail } from "@/lib/orders";

/**
 * GST breakdown for an order.
 *
 * Catalogue prices are GST-INCLUSIVE at a flat 18%, so the taxable value is
 * back-computed from what the customer actually pays rather than added on top:
 *
 *     taxable = payable / 1.18      gst = payable - taxable
 *
 * Split 9% CGST + 9% SGST when the delivery state matches the seller's
 * (Telangana), and a single 18% IGST line otherwise — an inter-state supply is
 * IGST by law, and printing CGST/SGST on it would make the invoice wrong.
 *
 * Shared deliberately: the email and the PDF must never disagree about tax. All
 * figures are integer paise, with the split rounded so the two halves always sum
 * back to the total exactly.
 */

/** Flat rate across the catalogue, as confirmed by the client. */
export const GST_RATE_PERCENT = 18;
const HALF_RATE = GST_RATE_PERCENT / 2;

/** The seller's registered state — supplies within it are CGST + SGST. */
const SELLER_STATE = "telangana";

export interface GstBreakdown {
  /** Value of the supply excluding tax. */
  taxablePaise: number;
  /** Total tax contained in the payable amount. */
  gstPaise: number;
  /** Set for an intra-state supply; both are half of `gstPaise`. */
  cgstPaise: number;
  sgstPaise: number;
  /** Set for an inter-state supply instead of CGST/SGST. */
  igstPaise: number;
  /** True when CGST/SGST applies (delivery inside the seller's state). */
  intraState: boolean;
  ratePercent: number;
  halfRatePercent: number;
  /** The state the goods were delivered to, as captured on the order. */
  placeOfSupply: string;
}

function deliveryState(order: OrderWithDetail): string {
  const a = order.addressSnapshot as Record<string, unknown> | null;
  const v = a?.state;
  return typeof v === "string" ? v.trim() : "";
}

export function gstFor(order: OrderWithDetail): GstBreakdown {
  const payable = Math.max(0, Math.round(order.totalPaise));
  const divisor = 1 + GST_RATE_PERCENT / 100;

  const taxablePaise = Math.round(payable / divisor);
  const gstPaise = payable - taxablePaise;

  const state = deliveryState(order);
  // Default to intra-state when the address carries no state: the seller is in
  // Telangana and that is the common case, and CGST/SGST is the safer default to
  // print than an IGST line that may not apply.
  const intraState = state === "" || state.toLowerCase() === SELLER_STATE;

  // Halve so the parts always reconstruct the whole, even on an odd paise value.
  const half = Math.floor(gstPaise / 2);
  const otherHalf = gstPaise - half;

  return {
    taxablePaise,
    gstPaise,
    cgstPaise: intraState ? half : 0,
    sgstPaise: intraState ? otherHalf : 0,
    igstPaise: intraState ? 0 : gstPaise,
    intraState,
    ratePercent: GST_RATE_PERCENT,
    halfRatePercent: HALF_RATE,
    placeOfSupply: state || "Telangana",
  };
}
