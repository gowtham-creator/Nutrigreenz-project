"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import { useAddresses } from "@/lib/addresses";
import { AddressForm } from "@/components/ng/address/address-form";
import type { Address } from "@/types/nutrigreenz";

const TYPE_META: Record<Address["type"], { icon: string; label: string }> = {
  home: { icon: "home-2-bold", label: "Home" },
  work: { icon: "buildings-2-bold", label: "Work" },
  other: { icon: "map-point-bold", label: "Other" },
};

export function AddressPicker({
  addresses,
  selectedId,
  onSelect,
}: {
  addresses: Address[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { add } = useAddresses();
  const [adding, setAdding] = useState(false);

  // Save a brand-new address right here in checkout, then select it — no need
  // to detour through the account page and back.
  function handleAdd(input: Parameters<typeof add>[0]) {
    const id = add(input);
    onSelect(id);
    setAdding(false);
    toast.success("Address added", { description: "It's now selected for this order." });
  }

  return (
    <div className="group/card rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-ng-float)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-cream text-ng-forest-deep">
          <UiIcon name="location" size={20} />
        </span>
        <div className="flex flex-col">
          <span className="ng-eyebrow text-ng-forest/70">Step 1</span>
          <h2 className="font-display text-[24px] leading-tight text-ng-forest-deep">
            Delivery address
          </h2>
        </div>
      </div>

      {/* Inline "add new address" form — opens right inside checkout. */}
      {adding ? (
        <div className="rounded-2xl border border-ng-line-soft bg-ng-cream/40 p-5 sm:p-6">
          <AddressForm onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ng-line bg-ng-cream/50 p-6 text-center">
          <p className="text-[14px] text-ng-ink-muted">
            You don&apos;t have any saved addresses yet.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ng-forest hover:text-ng-forest-deep"
          >
            <Icon name="add-circle-bold" size={16} />
            Add an address
          </button>
        </div>
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2">
          {addresses.map((address) => {
            const meta = TYPE_META[address.type];
            const heading =
              address.type === "other" && address.label
                ? address.label
                : meta.label;
            const selected = address.id === selectedId;
            return (
              <button
                key={address.id}
                type="button"
                onClick={() => onSelect(address.id)}
                aria-pressed={selected}
                className={cn(
                  "relative flex h-full flex-col gap-2 rounded-2xl border p-4 text-left transition-all",
                  selected
                    ? "border-ng-forest bg-ng-sage/30 shadow-[0_4px_18px_rgba(102,191,115,0.16)]"
                    : "border-ng-line-soft bg-ng-paper hover:border-ng-leaf",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ng-forest">
                    <Icon name={meta.icon} size={15} />
                    {heading}
                  </span>
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border transition-colors",
                      selected
                        ? "border-ng-forest bg-ng-forest text-ng-cream"
                        : "border-ng-line",
                    )}
                  >
                    {selected ? <Icon name="check-read-linear" size={12} /> : null}
                  </span>
                </div>
                <div className="text-[13px] leading-relaxed text-ng-ink-muted">
                  <p className="font-medium text-ng-ink">{address.fullName}</p>
                  <p className="line-clamp-2">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                  </p>
                  <p>
                    {address.city}, {address.state} {address.pincode}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {addresses.length > 0 && !adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ng-forest hover:text-ng-forest-deep"
        >
          <Icon name="add-circle-bold" size={16} />
          Add new address
        </button>
      ) : null}
    </div>
  );
}
