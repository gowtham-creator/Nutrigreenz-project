import "server-only";
import type { OrderWithDetail } from "@/lib/orders";
import { money } from "@/lib/invoice-ladder";

/**
 * GST breakdown for an order.
 *
 * Catalogue prices are GST-INCLUSIVE at a flat 5%, so the taxable value is
 * back-computed from what the customer actually pays rather than added on top:
 *
 *     taxable = payable / 1.05      gst = payable - taxable
 *
 * Split 2.5% CGST + 2.5% SGST when the delivery state matches the seller's
 * (Telangana), and a single 5% IGST otherwise. An inter-state supply is IGST by
 * law, so anything that prints this split has to honour that.
 *
 * The split is printed in one place, the line from `gstNote`, shared by the PDFs
 * and the order email so they cannot disagree about tax. Their ladders show only
 * what the customer pays (see invoice-ladder.ts). All figures are integer paise,
 * with the split rounded so the two halves always sum back to the total exactly.
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
 * fractional — `halfRatePercent` is a label only, while the actual money split
 * works in integer paise (see `gstFor`), so no rounding is lost.
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
  // Telangana and that is the common case, and CGST/SGST is a safer default than
  // an IGST split that may not apply.
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

/**
 * The GST line under the totals, on the invoice, the receipt and the order email.
 *
 * The amounts sit here rather than in the ladder because a tax invoice must state
 * the tax amount, and the owner wants the totals ladder kept to what the customer
 * pays. One small line does both, and building it only here means the documents
 * cannot disagree.
 *
 * An exclusive-mode order is worded differently, with no amounts. Its tax is
 * already a row on the ladder, so "Prices include GST" would be false, and gstFor
 * back-computes from an inclusive total, so its figures are not that order's tax.
 */
export function gstNote(order: OrderWithDetail): string {
  const gst = gstFor(order);
  const place = `Place of supply: ${gst.placeOfSupply}.`;
  if (order.taxPaise > 0) return `Tax is added to the prices shown above. ${place}`;

  const amounts = gst.intraState
    ? `CGST ${money(gst.cgstPaise)} + SGST ${money(gst.sgstPaise)}`
    : `IGST ${money(gst.igstPaise)}`;
  return `Prices include GST at ${gst.ratePercent}% (${amounts}). ${place}`;
}
