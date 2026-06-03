"use client";

import Link from "next/link";
import { use, useMemo, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import {
  loadReceipt,
  type OrderReceipt,
} from "@/components/ng/checkout/order-receipt";
import { InvoiceDocument } from "@/components/ng/invoice/invoice-document";
import { sampleReceipt } from "@/components/ng/invoice/sample-receipt";

const NOOP = () => () => {};

/**
 * Standalone, print-optimised GST tax invoice. NOT wrapped in PageShell so it
 * prints clean. Reads the receipt from sessionStorage using the same SSR-safe
 * `useSyncExternalStore` pattern as the confirmation page; if none exists for
 * this id (cold open / shared link), it renders a graceful *sample* invoice.
 */
export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Stable per-id snapshot so useSyncExternalStore doesn't loop.
  const getSnapshot = useMemo(() => {
    const cached = loadReceipt(id);
    return () => cached;
  }, [id]);

  const stored = useSyncExternalStore<OrderReceipt | null>(
    NOOP,
    getSnapshot,
    () => null,
  );

  // On the server (and the first client paint) `stored` is null because the
  // server snapshot is always null — so SSR and first hydration agree on the
  // sample. useSyncExternalStore then swaps in the real receipt when present,
  // which React reconciles without a hydration-mismatch warning.
  const isSample = !stored;
  const receipt = stored ?? sampleReceipt(id);

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="min-h-screen bg-ng-cream-deep/40 print:bg-white">
      {/* Control bar — hidden when printing */}
      <div className="sticky top-0 z-10 border-b border-ng-line bg-ng-paper/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-4 py-3">
          <Link
            href="/orders/track"
            className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-ng-forest transition-colors hover:bg-ng-sage/50 hover:text-ng-forest-deep"
          >
            <Icon name="arrow-left-bold" size={18} />
            Back
          </Link>
          <div className="flex items-center gap-3">
            {isSample ? (
              <span className="hidden items-center gap-1.5 text-[12px] text-ng-clay-deep sm:inline-flex">
                <Icon name="info-circle-bold" size={14} />
                Sample invoice (no live order found)
              </span>
            ) : null}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-full bg-ng-forest px-5 py-2.5 text-[14px] font-semibold text-ng-paper shadow-[0_4px_14px_rgba(31,77,46,0.25)] transition-all hover:-translate-y-0.5 hover:bg-ng-forest-deep"
            >
              <Icon name="printer-bold" size={18} />
              Download / Print
            </button>
          </div>
        </div>
      </div>

      {/* Document */}
      <main className="px-4 py-8 print:p-0">
        <InvoiceDocument receipt={receipt} isSample={isSample} />
      </main>

      {/* Print isolation: hide everything but the invoice, sane A4 margins. */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }
          html,
          body {
            background: #fff !important;
          }
          /* Hide site chrome / control bar; only the invoice document prints. */
          body * {
            visibility: hidden !important;
          }
          #ng-invoice,
          #ng-invoice * {
            visibility: visible !important;
          }
          #ng-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
