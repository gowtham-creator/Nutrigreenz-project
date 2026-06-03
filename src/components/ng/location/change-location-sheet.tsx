"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ng/button";
import { useLocation } from "@/lib/location";
import { cn } from "@/lib/utils";
import type { LocationZone } from "@/types/nutrigreenz";

interface ChangeLocationSheetProps {
  open: boolean;
  onClose: () => void;
}

const PIN_RE = /^\d{0,6}$/;

/** Pretty area label for a serviceable pincode (mirrors the lib's mock map). */
const AREA_BY_PINCODE: Record<string, string> = {
  "500081": "Madhapur",
  "500032": "Gachibowli",
  "500084": "Kondapur",
  "500072": "Kukatpally",
  "500085": "KPHB Colony",
  "500034": "Banjara Hills",
  "500033": "Jubilee Hills",
  "500016": "Begumpet",
  "500003": "Secunderabad",
  "500049": "Miyapur",
  "500089": "Manikonda",
  "500074": "LB Nagar",
  "500060": "Dilsukhnagar",
};

function areaFor(pincode: string): string {
  return AREA_BY_PINCODE[pincode] ?? "Hyderabad";
}

/**
 * Change-location sheet: GPS detect, manual pincode entry with live
 * serviceability feedback, and a one-tap list of popular Hyderabad areas.
 * Renders as a bottom sheet on mobile and a centred modal on desktop.
 */
export function ChangeLocationSheet({ open, onClose }: ChangeLocationSheetProps) {
  const { setZone, requestBrowserLocation, isServiceable, serviceablePincodes } = useLocation();
  const [mounted, setMounted] = useState(false);
  const [pincode, setPincode] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const inputId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset transient state + focus on open, lock body scroll, close on Escape.
  useEffect(() => {
    if (!open) return;
    setPincode("");
    setDetectError(null);
    setDetecting(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const trimmed = pincode.trim();
  const pinComplete = trimmed.length === 6;
  const pinServiceable = pinComplete && isServiceable(trimmed);
  const pinFeedback: "ok" | "no" | null = pinComplete ? (pinServiceable ? "ok" : "no") : null;

  const popular = useMemo(
    () => serviceablePincodes.map((p) => ({ pincode: p, area: areaFor(p) })),
    [serviceablePincodes],
  );

  function commit(zone: LocationZone) {
    setZone(zone);
    onClose();
  }

  async function handleDetect() {
    setDetectError(null);
    setDetecting(true);
    try {
      await requestBrowserLocation();
      onClose();
    } catch {
      setDetectError("Couldn't get your location. Enter your pincode instead.");
    } finally {
      setDetecting(false);
    }
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinServiceable) return;
    commit({ area: areaFor(trimmed), pincode: trimmed, city: "Hyderabad" });
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
    >
      <div
        className="absolute inset-0 bg-ng-forest-deep/45 backdrop-blur-sm motion-safe:animate-[fadeIn_.2s_ease]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative flex w-full max-w-md flex-col bg-ng-paper shadow-[var(--shadow-ng-float)]",
          "max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl sm:mx-4",
          "motion-safe:animate-[slideUp_.28s_cubic-bezier(0.32,0.72,0,1)]",
        )}
      >
        {/* grab handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-ng-line" />
        </div>

        <div className="flex items-start justify-between gap-4 px-6 pt-5 sm:pt-6">
          <div>
            <h2 id={`${inputId}-title`} className="font-display text-[22px] leading-tight text-ng-forest">
              Choose your location
            </h2>
            <p className="mt-1 text-[13px] text-ng-ink-muted">
              We deliver fresh across Hyderabad. Tell us where.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-ng-ink-muted hover:bg-ng-sage/50 hover:text-ng-forest transition-colors"
          >
            <Icon name="close-circle-linear" size={22} />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5 flex flex-col gap-5">
          {/* Use my current location */}
          <div>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleDetect}
              disabled={detecting}
              className="justify-start h-12 gap-3"
            >
              <Icon name="gps-bold" size={20} className="text-ng-leaf" />
              <span className="text-[14px] font-medium">
                {detecting ? "Detecting your location…" : "Use my current location"}
              </span>
            </Button>
            {detectError ? (
              <p className="mt-2 text-[12px] text-ng-danger">{detectError}</p>
            ) : null}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-ng-ink-soft">
            <span className="h-px flex-1 bg-ng-line" />
            or enter pincode
            <span className="h-px flex-1 bg-ng-line" />
          </div>

          {/* Manual pincode */}
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-2">
            <div
              className={cn(
                "flex items-center gap-2 h-12 px-4 rounded-xl bg-ng-paper border border-ng-line transition-all duration-200",
                "focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
                pinFeedback === "no" &&
                  "border-ng-danger focus-within:border-ng-danger focus-within:shadow-[0_0_0_3px_rgba(178,58,46,0.18)]",
                pinFeedback === "ok" && "border-ng-leaf",
              )}
            >
              <Icon name="map-point-bold" size={18} className="text-ng-ink-soft" />
              <input
                id={inputId}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="6-digit pincode"
                value={pincode}
                onChange={(e) => {
                  const v = e.target.value;
                  if (PIN_RE.test(v)) setPincode(v);
                }}
                aria-label="Delivery pincode"
                className="flex-1 bg-transparent outline-none text-[15px] tracking-wide text-ng-ink placeholder:text-ng-ink-soft"
              />
              {pinFeedback === "ok" ? (
                <Icon name="check-circle-bold" size={20} className="text-ng-leaf" />
              ) : null}
              <Button type="submit" size="sm" disabled={!pinServiceable} className="-mr-2">
                Apply
              </Button>
            </div>
            {pinFeedback === "ok" ? (
              <p className="text-[12px] text-ng-forest">
                Great news — we deliver to {areaFor(trimmed)} ({trimmed}).
              </p>
            ) : pinFeedback === "no" ? (
              <p className="text-[12px] text-ng-danger">
                Not serviceable yet. We&apos;re expanding across Hyderabad soon.
              </p>
            ) : (
              <p className="text-[12px] text-ng-ink-soft">Currently serving Hyderabad only.</p>
            )}
          </form>

          {/* Popular areas */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] font-medium text-ng-ink-muted">Popular areas</p>
            <ul className="grid grid-cols-2 gap-2">
              {popular.map(({ pincode: p, area }) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => commit({ area, pincode: p, city: "Hyderabad" })}
                    className="group flex w-full items-center gap-2 rounded-xl border border-ng-line-soft bg-ng-paper px-3 py-2.5 text-left transition-colors hover:border-ng-leaf hover:bg-ng-sage/40"
                  >
                    <Icon
                      name="map-point-linear"
                      size={16}
                      className="text-ng-ink-soft group-hover:text-ng-forest transition-colors"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ng-ink group-hover:text-ng-forest transition-colors">
                        {area}
                      </span>
                      <span className="block text-[11px] text-ng-ink-soft">{p}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
