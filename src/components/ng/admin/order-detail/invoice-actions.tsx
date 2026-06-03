"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import type { AdminOrder } from "@/components/ng/admin/orders-data";

/**
 * Invoice actions (§3.2): view the customer-facing GST invoice and (mock) send
 * it to the customer over WhatsApp / SMS. Sends are mocked with a sonner toast.
 */
export function InvoiceActions({ order }: { order: AdminOrder }) {
  const phone = order.customer.phone;

  return (
    <Card title="Invoice">
      <div className="space-y-3">
        <Link
          href={`/orders/${order.id}/invoice`}
          className="flex items-center justify-between gap-3 rounded-xl border border-ng-line-soft px-4 py-3 text-[13px] hover:bg-ng-cream transition-colors"
        >
          <span className="flex items-center gap-2.5 font-medium text-ng-ink">
            <Icon name="document-text-bold" size={17} className="text-ng-forest" />
            View invoice
          </span>
          <Icon name="arrow-right-up-linear" size={16} className="text-ng-ink-soft" />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              toast.success("Invoice sent on WhatsApp", {
                description: `Sent to ${phone}.`,
              })
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-ng-line-soft px-3 py-2.5 text-[12.5px] font-medium text-ng-ink hover:bg-ng-cream transition-colors"
          >
            <Icon name="chat-round-dots-bold" size={16} className="text-ng-success" />
            WhatsApp
          </button>
          <button
            onClick={() =>
              toast.success("Invoice sent via SMS", {
                description: `Sent to ${phone}.`,
              })
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-ng-line-soft px-3 py-2.5 text-[12.5px] font-medium text-ng-ink hover:bg-ng-cream transition-colors"
          >
            <Icon name="chat-line-bold" size={16} className="text-ng-forest" />
            SMS
          </button>
        </div>
      </div>
    </Card>
  );
}
