"use client";

import { Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import type { AdminOrder } from "@/components/ng/admin/orders-data";

/** Small label/value row used inside the info cards. */
function Field({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-ng-forest/70">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">{label}</div>
        <div className="text-[13px] font-medium text-ng-ink mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}

export function CustomerDeliveryCard({ order }: { order: AdminOrder }) {
  const { customer, address, slot, deliveryDate, channel } = order;
  return (
    <Card title="Customer & delivery">
      <div className="space-y-4">
        <Field icon="user-circle-bold" label="Customer">
          <div className="font-semibold text-ng-ink">{customer.name}</div>
          <div className="text-ng-ink-muted font-medium text-[12px]">
            {customer.phone} · {customer.email}
          </div>
        </Field>
        <Field icon="map-point-bold" label="Delivery address">
          {address.line1}
          <div className="text-ng-ink-muted font-medium text-[12px]">
            {address.community} · {address.area}
          </div>
          <div className="text-ng-ink-muted font-medium text-[12px]">
            {address.city} {address.pincode}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <Field icon="clock-circle-bold" label="Slot">
            {slot}
          </Field>
          <Field icon="calendar-bold" label="Delivery date">
            {new Date(deliveryDate).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </Field>
        </div>
        <Field icon="routing-2-bold" label="Channel">
          {channel}
        </Field>
      </div>
    </Card>
  );
}

export function PaymentCard({ order }: { order: AdminOrder }) {
  const failed = order.status === "Payment failed";
  const refund = order.status === "Refund req.";
  return (
    <Card title="Payment">
      <div className="space-y-4">
        <Field icon="card-bold" label="Method">
          {order.payment.method}
        </Field>
        <Field icon="bill-list-bold" label="State">
          <div className="flex items-center gap-2">
            <Pill tone={failed ? "danger" : refund ? "warn" : "success"}>
              {failed ? "Failed" : refund ? "Refund" : "Settled"}
            </Pill>
            <span className="text-[12px] font-medium text-ng-ink-muted">{order.payment.state}</span>
          </div>
        </Field>
      </div>
    </Card>
  );
}
