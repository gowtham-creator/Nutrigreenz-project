"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AppIcon } from "@/components/ui/app-icon";
import { useLocation } from "@/lib/location";
import { fetchServiceable } from "@/lib/serviceability";
import { cn } from "@/lib/utils";
import { ChangeLocationSheet } from "./change-location-sheet";

interface LocationPillProps {
  className?: string;
  /** "compact" = full-width mobile row; "pill" = inline desktop pill. */
  variant?: "pill" | "compact";
}

/**
 * Persistent "Deliver to" control. Shows the active zone (or a prompt to pick
 * one) and opens the change-location sheet on tap. Surfaces an amber hint when
 * a saved zone isn't currently serviceable.
 */
export function LocationPill({ className, variant = "pill" }: LocationPillProps) {
  const { zone } = useLocation();
  const [open, setOpen] = useState(false);
  // Live serviceability of the active zone, checked against the Super-Admin
  // serviceable-areas list via the public API. `null` = not yet checked.
  const [liveServiceable, setLiveServiceable] = useState<boolean | null>(null);

  const zonePincode = zone?.pincode ?? "";
  useEffect(() => {
    if (!/^\d{6}$/.test(zonePincode)) {
      setLiveServiceable(null);
      return;
    }
    let cancelled = false;
    fetchServiceable(zonePincode).then((ok) => {
      if (!cancelled) setLiveServiceable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [zonePincode]);

  const hasZone = zone !== null;
  // Only flag "not serviceable" when we have a complete pincode that the live list
  // doesn't cover; a detected area without a postcode just shows the area name.
  // Defaults to serviceable while the check is in flight (fail-open).
  const serviceable = !hasZone || !zone.pincode || (liveServiceable ?? true);
  const label = hasZone
    ? zone.pincode
      ? `${zone.area}, ${zone.pincode}`
      : zone.area
    : "Select your location";

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={hasZone ? `Deliver to ${label}. Change location.` : "Select your delivery location"}
          className={cn(
            "flex w-full items-center gap-2.5 px-5 py-2.5 text-left transition-colors active:bg-ng-sage/30",
            className,
          )}
        >
          <AppIcon name="location" size={18} className="shrink-0 text-ng-leaf" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ng-ink-soft">
              Deliver to
            </span>
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-ng-forest">{label}</span>
              {hasZone && !serviceable ? (
                <span className="shrink-0 rounded-full bg-ng-amber/15 px-1.5 py-0.5 text-[10px] font-medium text-ng-amber">
                  Not serviceable yet
                </span>
              ) : null}
            </span>
          </span>
          <Icon name="alt-arrow-down-linear" size={16} className="shrink-0 text-ng-ink-muted" />
        </button>
        <ChangeLocationSheet open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={hasZone ? `Deliver to ${label}. Change location.` : "Select your delivery location"}
        className={cn(
          "group inline-flex max-w-[230px] items-center gap-2 rounded-full border border-ng-line bg-ng-paper/70 px-3.5 py-2 transition-all duration-200",
          "hover:border-ng-leaf hover:bg-ng-sage/40 hover:-translate-y-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper",
          className,
        )}
      >
        <AppIcon name="location" size={18} className="shrink-0 text-ng-leaf" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ng-ink-soft">
            Deliver to
          </span>
          <span className="flex items-center gap-1">
            <span className="truncate text-[13px] font-medium text-ng-forest">{label}</span>
            {hasZone && !serviceable ? (
              <Icon name="danger-triangle-bold" size={13} className="shrink-0 text-ng-amber" label="Not serviceable yet" />
            ) : null}
          </span>
        </span>
        <Icon
          name="alt-arrow-down-linear"
          size={15}
          className="shrink-0 text-ng-ink-muted transition-transform group-hover:translate-y-0.5"
        />
      </button>
      <ChangeLocationSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
