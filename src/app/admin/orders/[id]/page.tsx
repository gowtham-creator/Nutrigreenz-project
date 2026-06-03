"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import {
  getOrder,
  itemCount,
  INR,
  STATUS_TONE,
  type OrderStatus,
} from "@/components/ng/admin/orders-data";
import { StatusPipeline } from "@/components/ng/admin/order-detail/status-pipeline";
import { StatusActions } from "@/components/ng/admin/order-detail/status-actions";
import { LineItems } from "@/components/ng/admin/order-detail/line-items";
import { CustomerDeliveryCard, PaymentCard } from "@/components/ng/admin/order-detail/info-cards";
import { InvoiceActions } from "@/components/ng/admin/order-detail/invoice-actions";
import { ActivityTimeline } from "@/components/ng/admin/order-detail/activity-timeline";

const backAction = (
  <Link
    href="/admin/orders"
    className="inline-flex items-center gap-2 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
  >
    <Icon name="arrow-left-linear" size={15} />
    Back to orders
  </Link>
);

export default function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = getOrder(id);

  // Local, optimistic status — drives both the pill and the pipeline stepper.
  const [status, setStatus] = useState<OrderStatus | null>(order ? order.status : null);

  if (!order || status === null) {
    return (
      <AdminShell active="/admin/orders" title="Order not found" subtitle={id} actions={backAction}>
        <Card className="text-center py-16">
          <div className="mx-auto size-12 rounded-full bg-ng-cream flex items-center justify-center text-ng-ink-soft mb-4">
            <Icon name="box-minimalistic-broken" size={24} />
          </div>
          <h2 className="font-display text-[20px] text-ng-forest-deep">We couldn&rsquo;t find that order</h2>
          <p className="text-[13px] text-ng-ink-muted mt-2">
            No order matches <span className="font-mono">{id}</span>.
          </p>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] mt-6 hover:bg-ng-forest transition-colors"
          >
            <Icon name="arrow-left-linear" size={15} /> Back to orders
          </Link>
        </Card>
      </AdminShell>
    );
  }

  const subtotal = order.items.reduce((sum, it) => sum + it.price * it.qty, 0);

  return (
    <AdminShell
      active="/admin/orders"
      title={order.id}
      subtitle={`${order.customer.name} · placed ${order.placedAt}`}
      actions={backAction}
    >
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {/* Status pipeline + actions */}
          <Card
            title="Status"
            action={<Pill tone={STATUS_TONE[status]}>{status}</Pill>}
          >
            <div className="pt-2 pb-1">
              <StatusPipeline status={status} />
            </div>
            <div className="mt-7 pt-5 border-t border-ng-line-soft">
              <StatusActions status={status} onChange={setStatus} />
            </div>
          </Card>

          {/* Line items + lot assignment */}
          <Card title="Line items">
            <LineItems items={order.items} />
          </Card>

          {/* Customer & payment */}
          <div className="grid md:grid-cols-2 gap-6">
            <CustomerDeliveryCard order={order} />
            <PaymentCard order={order} />
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Order summary */}
          <Card title="Summary">
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ng-ink-muted">Items ({itemCount(order)})</dt>
                <dd className="tabular-nums">{INR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ng-ink-muted">Delivery</dt>
                <dd className="text-ng-success">Free</dd>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-ng-line-soft text-[15px]">
                <dt className="font-display text-ng-forest-deep">Total</dt>
                <dd className="font-display text-ng-forest-deep tabular-nums">{INR(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <InvoiceActions order={order} />
          <ActivityTimeline timeline={order.timeline} />
        </div>
      </div>
    </AdminShell>
  );
}
