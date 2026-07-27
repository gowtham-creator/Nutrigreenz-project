"use client";

import { Logo } from "@/components/ng/logo";
import { Icon } from "@/components/ui/icon";
import type { OrderReceipt } from "@/components/ng/checkout/order-receipt";
import {
  amountInWords,
  buildLines,
  computeInvoiceTotals,
  inr2,
} from "./invoice-math";

/* ── Seller (legal entity) constants ─────────────────────────────── */
const SELLER = {
  legalName: "Nutri Greenz Farm Technologies Pvt. Ltd",
  address: "KPHB Colony, Kukatpally, Hyderabad, Telangana 500072",
  gstin: "36ABCDE1234F1Z5",
  email: "support@nutrigreenz.farm",
  phone: "+91 90000 12345",
  cin: "U01400TG2024PTC012345",
} as const;

const PLACE_OF_SUPPLY = "Telangana (36)";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * The printable tax-invoice document. Pure presentation — receipt (real or
 * sample) is resolved by the page. `isSample` shows a discreet watermark/notice.
 */
export function InvoiceDocument({
  receipt,
  isSample = false,
}: {
  receipt: OrderReceipt;
  isSample?: boolean;
}) {
  const lines = buildLines(receipt.items);
  const totals = computeInvoiceTotals({
    lines,
    couponDiscount: receipt.couponDiscount || 0,
    loyaltyDiscount: receipt.loyaltyDiscount || 0,
    shipping: receipt.shipping || 0,
    paidTotal: receipt.total,
  });
  const address = receipt.address;
  const payment = receipt.payment;

  return (
    <article
      id="ng-invoice"
      className="mx-auto w-full max-w-[820px] bg-white text-ng-ink shadow-[0_2px_24px_rgba(20,51,31,0.08)] print:max-w-none print:shadow-none"
    >
      <div className="relative overflow-hidden p-8 sm:p-10 print:p-0">
        {isSample ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-6 top-24 select-none rotate-12 text-[64px] font-bold uppercase tracking-widest text-ng-leaf/10 print:text-ng-leaf/15"
          >
            Sample
          </span>
        ) : null}

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="flex flex-col gap-6 border-b-2 border-ng-forest/15 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[58%]">
            <Logo variant="full" className="h-10" priority />
            <p className="mt-3 text-[14px] font-semibold text-ng-forest-deep">
              {SELLER.legalName}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ng-ink-muted">
              {SELLER.address}
            </p>
            <p className="mt-2 text-[12px] text-ng-ink-muted">
              <span className="font-semibold text-ng-ink">GSTIN:</span>{" "}
              <span className="tabular-nums tracking-wide">{SELLER.gstin}</span>
            </p>
            <p className="text-[12px] text-ng-ink-muted">
              <span className="font-semibold text-ng-ink">CIN:</span>{" "}
              <span className="tabular-nums tracking-wide">{SELLER.cin}</span>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-ng-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Icon name="letter-bold" size={13} className="text-ng-forest" />
                {SELLER.email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="phone-bold" size={13} className="text-ng-forest" />
                {SELLER.phone}
              </span>
            </p>
          </div>

          <div className="sm:text-right">
            <h1 className="font-display text-[26px] leading-none tracking-tight text-ng-forest-deep">
              TAX INVOICE
            </h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ng-clay-deep">
              Original for Recipient
            </p>
            <dl className="mt-4 space-y-1 text-[12px]">
              <MetaRow label="Invoice No." value={receipt.id} mono />
              <MetaRow label="Date" value={formatDate(receipt.placedAt)} />
              <MetaRow label="Place of supply" value={PLACE_OF_SUPPLY} />
              <MetaRow
                label="Payment"
                value={
                  payment
                    ? `${payment.label} · ${payment.categoryLabel}`
                    : "—"
                }
              />
            </dl>
          </div>
        </header>

        {/* ── Bill to / Ship to ──────────────────────────────────── */}
        <section className="mt-6 grid gap-5 sm:grid-cols-2">
          <PartyCard title="Bill to" address={address} />
          <PartyCard title="Ship to" address={address} />
        </section>

        {/* ── Inclusive note ─────────────────────────────────────── */}
        <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-ng-sage/30 px-3 py-1.5 text-[11px] font-medium text-ng-forest-deep">
          <Icon name="info-circle-bold" size={14} className="text-ng-forest" />
          Listed prices are inclusive of GST @ 5% (CGST 2.5% + SGST 2.5%).
          Taxable value is back-calculated from the inclusive price.
        </p>

        {/* ── Line items ─────────────────────────────────────────── */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-ng-forest/20 bg-ng-cream/60 text-left text-[10px] uppercase tracking-wider text-ng-ink-muted">
                <th className="py-2 pl-1 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Item &amp; description</th>
                <th className="py-2 pr-2 text-center font-semibold">HSN</th>
                <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                <th className="py-2 pr-2 text-right font-semibold">Rate</th>
                <th className="py-2 pr-2 text-right font-semibold">Taxable</th>
                <th className="py-2 pr-2 text-right font-semibold">GST%</th>
                <th className="py-2 pr-2 text-right font-semibold">GST amt</th>
                <th className="py-2 pr-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {lines.map((line, i) => (
                <tr
                  key={line.productId}
                  className="border-b border-ng-line-soft align-top"
                >
                  <td className="py-2 pl-1 pr-2 text-ng-ink-soft">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <span className="font-medium text-ng-ink">
                      {line.title}
                    </span>
                    {line.unit ? (
                      <span className="block text-[11px] text-ng-ink-soft">
                        {line.unit}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-center">{line.hsn}</td>
                  <td className="py-2 pr-2 text-right">{line.qty}</td>
                  <td className="py-2 pr-2 text-right">{inr2(line.rate)}</td>
                  <td className="py-2 pr-2 text-right">{inr2(line.taxable)}</td>
                  <td className="py-2 pr-2 text-right">
                    {(line.gstRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {inr2(line.cgst + line.sgst)}
                  </td>
                  <td className="py-2 pr-1 text-right font-medium text-ng-ink">
                    {inr2(line.gross)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ng-forest/20 text-[11px] font-semibold text-ng-ink">
                <td colSpan={5} className="py-2 pl-1 text-right uppercase tracking-wider text-ng-ink-muted">
                  Totals
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {inr2(totals.taxableValue)}
                </td>
                <td className="py-2 pr-2" />
                <td className="py-2 pr-2 text-right tabular-nums">
                  {inr2(totals.totalTax)}
                </td>
                <td className="py-2 pr-1 text-right tabular-nums">
                  {inr2(totals.itemsTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Totals + tax breakup ───────────────────────────────── */}
        <section className="mt-6 grid gap-6 sm:grid-cols-[1fr_300px]">
          {/* Tax breakup card */}
          <div className="rounded-lg border border-ng-line bg-ng-cream/40 p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
              GST breakup (intra-state)
            </h3>
            <table className="mt-2 w-full text-[11px] tabular-nums">
              <tbody>
                <tr className="text-ng-ink-muted">
                  <td className="py-0.5">Taxable value</td>
                  <td className="py-0.5 text-right text-ng-ink">
                    {inr2(totals.taxableValue)}
                  </td>
                </tr>
                <tr className="text-ng-ink-muted">
                  <td className="py-0.5">CGST @ 2.5%</td>
                  <td className="py-0.5 text-right text-ng-ink">
                    {inr2(totals.cgst)}
                  </td>
                </tr>
                <tr className="text-ng-ink-muted">
                  <td className="py-0.5">SGST @ 2.5%</td>
                  <td className="py-0.5 text-right text-ng-ink">
                    {inr2(totals.sgst)}
                  </td>
                </tr>
                <tr className="border-t border-ng-line font-semibold text-ng-ink">
                  <td className="pt-1">Total GST</td>
                  <td className="pt-1 text-right">{inr2(totals.totalTax)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-ng-ink-muted">
              <span className="font-semibold text-ng-ink">
                Amount in words:
              </span>{" "}
              {amountInWords(totals.grandTotal)}
            </p>
          </div>

          {/* Money column */}
          <dl className="space-y-2 text-[13px]">
            <TotalRow label="Taxable value" value={inr2(totals.taxableValue)} />
            <TotalRow label="CGST (2.5%)" value={inr2(totals.cgst)} />
            <TotalRow label="SGST (2.5%)" value={inr2(totals.sgst)} />
            <TotalRow
              label="Subtotal (incl. GST)"
              value={inr2(totals.itemsTotal)}
            />
            {totals.couponDiscount > 0 ? (
              <TotalRow
                label={
                  receipt.couponCode
                    ? `Coupon (${receipt.couponCode})`
                    : "Coupon discount"
                }
                value={`− ${inr2(totals.couponDiscount)}`}
                discount
              />
            ) : null}
            {totals.loyaltyDiscount > 0 ? (
              <TotalRow
                label={
                  receipt.loyaltyPoints
                    ? `Loyalty redemption (${receipt.loyaltyPoints} pts)`
                    : "Loyalty redemption"
                }
                value={`− ${inr2(totals.loyaltyDiscount)}`}
                discount
              />
            ) : null}
            <TotalRow
              label="Shipping"
              value={totals.shipping === 0 ? "Free" : inr2(totals.shipping)}
            />
            {Math.abs(totals.roundOff) >= 0.005 ? (
              <TotalRow
                label="Round off"
                value={`${totals.roundOff >= 0 ? "+ " : "− "}${inr2(
                  Math.abs(totals.roundOff),
                )}`}
              />
            ) : null}
            <div className="mt-1 flex items-baseline justify-between border-t-2 border-ng-forest/20 pt-3">
              <dt className="text-[12px] font-semibold uppercase tracking-wider text-ng-forest-deep">
                Grand Total
              </dt>
              <dd className="text-[22px] font-bold tabular-nums text-ng-forest-deep">
                {inr2(totals.grandTotal)}
              </dd>
            </div>
          </dl>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="mt-8 border-t border-ng-line pt-5 text-[11px] leading-relaxed text-ng-ink-muted">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-ng-ink">
                  No-cancellation policy:
                </span>{" "}
                Orders are freshly packed against farm lots the moment they are
                confirmed and cannot be cancelled or modified once placed.
                Returns are accepted only for damaged or incorrect items.
              </p>
              <p className="inline-flex items-center gap-1.5">
                <Icon
                  name="leaf-bold"
                  size={13}
                  className="text-ng-forest"
                />
                Every item is single-origin and lot-traceable to its source farm
                &mdash; scan the lot code on the pack to view its QC report.
              </p>
            </div>
            <div className="text-[11px] sm:text-right">
              <p className="font-display text-[13px] text-ng-forest-deep">
                Thank you for choosing Nutri Greenz.
              </p>
              <p className="mt-1 text-ng-ink-soft">
                This is a computer-generated invoice &mdash; no signature
                required.
              </p>
              <p className="mt-3 text-ng-ink-soft">For {SELLER.legalName}</p>
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 sm:justify-end">
      <dt className="text-ng-ink-soft">{label}</dt>
      <dd
        className={`font-medium text-ng-ink ${mono ? "tabular-nums tracking-wide" : "tabular-nums"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function PartyCard({
  title,
  address,
}: {
  title: string;
  address: OrderReceipt["address"];
}) {
  return (
    <div className="rounded-lg border border-ng-line-soft p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ng-ink-soft">
        {title}
      </p>
      {address ? (
        <div className="mt-1.5 text-[12px] leading-relaxed text-ng-ink">
          <p className="text-[13px] font-semibold text-ng-forest-deep">
            {address.fullName}
          </p>
          <p className="text-ng-ink-muted">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
          </p>
          <p className="text-ng-ink-muted">
            {address.city}, {address.state} {address.pincode}
          </p>
          {address.phone ? (
            <p className="mt-1 text-ng-ink-muted">
              <span className="font-semibold text-ng-ink">Ph:</span>{" "}
              {address.phone}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-[12px] text-ng-ink-muted">
          Registered customer address
        </p>
      )}
    </div>
  );
}

function TotalRow({
  label,
  value,
  discount,
}: {
  label: string;
  value: string;
  discount?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <dt className="text-ng-ink-muted">{label}</dt>
      <dd
        className={`tabular-nums ${
          discount ? "font-semibold text-ng-green-bright" : "font-medium text-ng-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
