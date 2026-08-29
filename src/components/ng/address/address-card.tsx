"use client";

import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";
import type { Address } from "@/types/nutrigreenz";

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const TYPE_META: Record<
  Address["type"],
  { icon: string; label: string; chip: string }
> = {
  home: { icon: "home", label: "Home", chip: "bg-ng-leaf/15 text-ng-forest" },
  work: { icon: "office", label: "Work", chip: "bg-ng-blue/12 text-ng-blue" },
  other: { icon: "location", label: "Other", chip: "bg-ng-clay/18 text-ng-clay-deep" },
};

export function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressCardProps) {
  const meta = TYPE_META[address.type];
  const heading =
    address.type === "other" && address.label ? address.label : meta.label;
  const isDefault = Boolean(address.isDefault);

  return (
    <article
      className={cn(
        "ng-float relative flex h-full flex-col gap-4 rounded-2xl bg-ng-paper border p-5 transition-all",
        isDefault
          ? "border-ng-leaf/70 shadow-[0_6px_22px_-8px_rgba(102,191,115,0.4)] ring-1 ring-ng-leaf/20"
          : "border-ng-line-soft hover:border-ng-leaf/50",
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", meta.chip)}>
            <Icon name={meta.icon} size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[18px] leading-tight text-ng-ink truncate">
              {heading}
            </h3>
            <p className="text-[11px] uppercase tracking-wider text-ng-ink-soft">
              {meta.label}
            </p>
          </div>
        </div>
        {isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ng-forest">
            <UiIcon name="verified" size={13} className="text-ng-green-bright" />
            Default
          </span>
        ) : null}
      </header>

      <div className="text-[14px] leading-relaxed text-ng-ink-muted">
        <p className="font-medium text-ng-ink">{address.fullName}</p>
        <p>{address.line1}</p>
        {address.line2 ? <p>{address.line2}</p> : null}
        {address.landmark ? (
          <p className="text-ng-ink-soft">Landmark: {address.landmark}</p>
        ) : null}
        <p>
          {address.city}, {address.state} {address.pincode}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-ng-ink-soft">
          <Icon name="phone-rounded-linear" size={14} />
          {address.phone}
        </p>
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-ng-line-soft pt-3 text-[13px] font-medium">
        <button
          type="button"
          onClick={() => onEdit(address)}
          className="-my-1.5 inline-flex min-h-[44px] items-center gap-1.5 py-1.5 text-ng-forest hover:text-ng-forest-deep transition-colors"
        >
          <UiIcon name="edit" size={15} />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(address.id)}
          className="-my-1.5 inline-flex min-h-[44px] items-center gap-1.5 py-1.5 text-ng-ink-muted hover:text-ng-danger transition-colors"
        >
          <Icon name="trash-bin-trash-linear" size={15} />
          Delete
        </button>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onSetDefault(address.id)}
            className="-my-1.5 ml-auto inline-flex min-h-[44px] items-center gap-1.5 py-1.5 text-ng-leaf hover:text-ng-forest transition-colors"
          >
            <UiIcon name="verified" size={15} />
            Set as default
          </button>
        ) : null}
      </footer>
    </article>
  );
}
