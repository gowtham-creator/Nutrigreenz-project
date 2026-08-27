import "server-only";
import type { OrderWithDetail } from "@/lib/orders";

/**
 * GST breakdown for an order.
 *
 * Catalogue prices are GST-INCLUSIVE at a flat 5%, so the taxable value is
 * back-computed from what the customer actually pays rather than added on top:
 *
 *     taxable = payable / 1.05      gst = payable - taxable
 *
 * Split 2.5% CGST + 2.5% SGST when the delivery state matches the seller's
 * (Telangana), and a single 5% IGST line otherwise. An inter-state supply is
 * IGST by law, and printing CGST/SGST on it would make the invoice wrong.
 *
 * Shared deliberately: the email and the PDF must never disagree about tax. All
 * figures are integer paise, with the split rounded so the two halves always sum
 * back to the total exactly.
 *
 * ── On changing this rate ─────────────────────────────────────────────────
 *
 * Because pricing is INCLUSIVE, the rate does not change what the customer
 * pays. It changes how that payment is split between taxable value and tax:
 * lowering it moves money from the tax line into the taxable value. On a ₹720
 * order, 18% yields ₹610.17 + ₹109.83 tax; 5% yields ₹685.71 + ₹34.29. The
 * customer is charged ₹720 either way.
 *
 * It is therefore NOT a way to reprice the catalogue, and changing it applies
 * to invoices generated from now on — previously issued invoices keep whatever
 * rate they were computed and sent with.
 */

/**
 * Flat rate across the catalogue.
 *
 * The half-rate below is derived rather than written out, so CGST + SGST can
 * never drift from the headline rate. At 5% the halves are 2.5% each, which is
 * fractional — `halfRatePercent` is consumed for display only, while the actual
 * money split works in integer paise (see `gstFor`), so no rounding is lost.
 */
export const GST_RATE_PERCENT = 5;
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
