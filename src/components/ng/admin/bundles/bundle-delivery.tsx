"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { deliveryWhenLabel, shortCommunity } from "@/lib/community-label";
import type { BundleCaptain, BundleGroup, BundleSlot } from "@/lib/order-bundles";

const ERROR_TEXT: Record<string, string> = {
  "past-date": "Choose today or a later date.",
  "invalid-date": "Choose a delivery date.",
  "invalid-window": "Choose a delivery slot.",
  "no-orders": "These orders are already assigned or can't be delivered now. Refresh and check.",
  "captain-unavailable": "That captain isn't active. Choose another.",
  "captain-network-off": "Switch on Captain network in Feature toggles first.",
};

const STATUS_TEXT = { due: "Not started", collected: "Out for delivery", handed_over: "Delivered" } as const;

const FIELD =
  "h-10 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[13px] text-ng-ink outline-none focus:border-ng-forest";

/** Today in India, for the date picker's lower limit. */
function istToday(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * The delivery part of a bundle: who takes it, when, and how far they have got.
 * Only orders not yet on a run are assigned, so a part-assigned bundle can take a
 * second run for the orders that came in later.
 */
export function BundleDelivery({
  group,
  captains,
  slots,
  onChanged,
}: {
  group: BundleGroup;
  captains: BundleCaptain[];
  slots: BundleSlot[];
  onChanged: () => void;
}) {
  const unassigned = group.orders.filter((o) => !o.pickupId);
  const [open, setOpen] = useState(false);
  const [captainId, setCaptainId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);

  // Captains who already serve this community come first.
  const name = group.community.toLowerCase();
  const serves = (c: BundleCaptain) =>
    c.communities.some((x) => shortCommunity(x).toLowerCase().includes(name) || x.toLowerCase().includes(name));
  const ordered = [...captains].sort((a, b) => Number(serves(b)) - Number(serves(a)));

  async function assign() {
    if (!captainId || !date || !slot) {
      toast.error("Choose a captain, a date and a slot");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders/bundles/pickups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderIds: unassigned.map((o) => o.id),
          captainId,
          deliveryDate: date,
          windowText: slot,
          community: group.community,
          address: [group.area, group.city, group.pincode].filter(Boolean).join(", "),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; orders?: number };
      if (!res.ok || !data.ok) {
        toast.error("Delivery not assigned", {
          description: ERROR_TEXT[data.error ?? ""] ?? "Couldn't save it. Try again.",
        });
        return;
      }
      toast.success(`Delivery assigned to ${data.orders} order${data.orders === 1 ? "" : "s"}`, {
        description: "The captain can see it now, and customers are being emailed.",
      });
      setOpen(false);
      onChanged();
    } catch {
      toast.error("Delivery not assigned", { description: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/bundles/pickups/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delivery not removed", {
          description: res.status === 409 ? "The captain has already collected this run." : "Try again.",
        });
        return;
      }
      toast.success("Delivery removed", {
        description: "Those orders are back in the bundle. Customers who were emailed aren't told automatically.",
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-4 border-t border-ng-line-soft bg-ng-sage/10">
      {group.deliveries.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2 py-1.5 text-[12.5px]">
          <Icon name="calendar-bold" size={14} className="text-ng-forest" />
          <span className="font-semibold text-ng-ink">{deliveryWhenLabel(d.deliveryDate, d.windowText)}</span>
          <span className="text-ng-ink-muted">
            {d.captainName} · {d.orderCount} order{d.orderCount === 1 ? "" : "s"}
          </span>
          <Pill tone={d.status === "due" ? "neutral" : d.status === "collected" ? "info" : "success"}>
            {STATUS_TEXT[d.status]}
          </Pill>
          {d.status === "due" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove(d.id)}
              className="ml-auto text-[12px] font-semibold text-ng-danger hover:underline cursor-pointer disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}

      {unassigned.length > 0 && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep px-4 py-2 text-[12.5px] font-semibold text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer"
        >
          <Icon name="add-circle-bold" size={14} />
          Assign delivery ({unassigned.length} order{unassigned.length === 1 ? "" : "s"})
        </button>
      ) : null}

      {unassigned.length > 0 && open ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="text-[12px] font-medium text-ng-ink-muted">
            Captain
            <select value={captainId} onChange={(e) => setCaptainId(e.target.value)} className={`${FIELD} mt-1`}>
              <option value="">Choose a captain</option>
              {ordered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {serves(c) ? " (serves this community)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-medium text-ng-ink-muted">
            Delivery date
            <input
              type="date"
              min={istToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${FIELD} mt-1`}
            />
          </label>
          <label className="text-[12px] font-medium text-ng-ink-muted">
            Slot
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={`${FIELD} mt-1`}>
              <option value="">Choose a slot</option>
              {slots.map((s) => {
                const label = s.windowText ? `${s.label} (${s.windowText})` : s.label;
                return (
                  <option key={s.id} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="sm:col-span-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-ng-line px-4 py-2 text-[12.5px] font-medium text-ng-ink hover:bg-ng-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void assign()}
              className="rounded-full bg-ng-forest-deep px-4 py-2 text-[12.5px] font-semibold text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy ? "Saving…" : "Assign and email customers"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
