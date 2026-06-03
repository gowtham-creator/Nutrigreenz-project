"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ng/button";
import { useLocation, lookupArea } from "@/lib/location";
import { cn } from "@/lib/utils";

const ONBOARDED_KEY = "ng-loc-onboarded";

/**
 * First-visit, non-blocking location prompt (Zepto/Swiggy style). Shown once
 * per browser; after detect / pincode / skip we set a localStorage flag and
 * never auto-open again — the LocationPill remains tappable for later changes.
 */
export function LocationOnboarding() {
  const { zone, setZone, requestBrowserLocation, isServiceable } = useLocation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"choose" | "pincode">("choose");
  const [pincode, setPincode] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Decide whether to auto-show, once, after hydration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let onboarded = false;
    try {
      onboarded = window.localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      onboarded = true; // storage blocked → don't nag
    }
    // If a zone is already chosen, treat as onboarded.
    if (onboarded || zone) return;
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
    // run once on mount; intentionally not reacting to later zone changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markOnboarded() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function dismiss() {
    markOnboarded();
    setOpen(false);
  }

  // Escape + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleDetect() {
    setError(null);
    setDetecting(true);
    try {
      await requestBrowserLocation();
      dismiss();
    } catch {
      setError("Couldn't detect your location. Enter your pincode instead.");
      setMode("pincode");
    } finally {
      setDetecting(false);
    }
  }

  const trimmed = pincode.trim();
  const complete = trimmed.length === 6;
  const serviceable = complete && isServiceable(trimmed);

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceable) return;
    setZone({ area: lookupArea(trimmed), pincode: trimmed, city: "Hyderabad" });
    dismiss();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ng-onboard-title"
    >
      <div
        className="absolute inset-0 bg-ng-forest-deep/50 backdrop-blur-sm motion-safe:animate-[fadeIn_.25s_ease]"
        onClick={dismiss}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden bg-ng-paper shadow-[var(--shadow-ng-float)]",
          "rounded-t-3xl sm:rounded-3xl sm:mx-4",
          "motion-safe:animate-[popIn_.32s_cubic-bezier(0.32,0.72,0,1)]",
        )}
      >
        {/* Leafy header band */}
        <div className="relative bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-leaf px-6 pb-7 pt-7 text-ng-paper">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Skip for now"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-ng-paper/80 hover:bg-ng-paper/15 hover:text-ng-paper transition-colors"
          >
            <Icon name="close-circle-linear" size={20} />
          </button>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-ng-paper/15">
            <Icon name="map-point-wave-bold" size={26} className="text-ng-paper" />
          </span>
          <h2 id="ng-onboard-title" className="mt-3 font-display text-[24px] leading-tight">
            Where should we deliver?
          </h2>
          <p className="mt-1 text-[13px] text-ng-paper/80">
            Set your location to see what we can deliver fresh to your door across Hyderabad.
          </p>
        </div>

        <div className="px-6 pb-6 pt-5">
          {mode === "choose" ? (
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleDetect}
                disabled={detecting}
                className="gap-2.5"
              >
                <Icon name="gps-bold" size={20} />
                {detecting ? "Detecting…" : "Use my location"}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                size="lg"
                onClick={() => {
                  setError(null);
                  setMode("pincode");
                }}
                className="gap-2.5"
              >
                <Icon name="map-point-search-bold" size={20} className="text-ng-leaf" />
                Enter pincode
              </Button>
              {error ? <p className="text-center text-[12px] text-ng-danger">{error}</p> : null}
              <button
                type="button"
                onClick={dismiss}
                className="mx-auto mt-1 text-[13px] font-medium text-ng-ink-muted hover:text-ng-forest transition-colors"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <form onSubmit={handlePinSubmit} className="flex flex-col gap-3">
              <div
                className={cn(
                  "flex items-center gap-2 h-12 px-4 rounded-xl bg-ng-paper border border-ng-line transition-all duration-200",
                  "focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)]",
                  complete && !serviceable &&
                    "border-ng-danger focus-within:border-ng-danger focus-within:shadow-[0_0_0_3px_rgba(178,58,46,0.18)]",
                  serviceable && "border-ng-leaf",
                )}
              >
                <Icon name="map-point-bold" size={18} className="text-ng-ink-soft" />
                <input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="6-digit pincode"
                  value={pincode}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d{0,6}$/.test(v)) setPincode(v);
                  }}
                  aria-label="Delivery pincode"
                  className="flex-1 bg-transparent outline-none text-[15px] tracking-wide text-ng-ink placeholder:text-ng-ink-soft"
                />
                {serviceable ? <Icon name="check-circle-bold" size={20} className="text-ng-leaf" /> : null}
              </div>
              {complete && !serviceable ? (
                <p className="text-[12px] text-ng-danger">
                  Not serviceable yet. We&apos;re expanding across Hyderabad soon.
                </p>
              ) : (
                <p className="text-[12px] text-ng-ink-soft">Currently serving Hyderabad only.</p>
              )}
              <Button type="submit" fullWidth size="lg" disabled={!serviceable}>
                Confirm location
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode("choose");
                  setError(null);
                }}
                className="mx-auto text-[13px] font-medium text-ng-ink-muted hover:text-ng-forest transition-colors"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
