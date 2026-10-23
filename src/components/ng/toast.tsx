"use client";

import { Toaster, toast as sonner } from "sonner";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Nutri Greenz notifications.
 *
 * One look for every toast in the product. 43 files call sonner's `toast()`
 * directly and the profile page uses `ngToast`; both render through
 * <NgToaster>, which restyles sonner's own toast instead of drawing a custom
 * one, so a call site never decides how a notification looks.
 *
 * The toast is a forest slip with cream type. On the cream storefront a light
 * toast needed a heavy shadow to separate from the page; forest separates by
 * itself and is the brand's own colour. The state is carried by the glyph, in
 * colour and in shape (tick, triangle, circle), so the copy stays on one quiet
 * ground and colour is never the only signal.
 *
 * Earlier versions had a coloured rail down the leading edge and a progress
 * line along the bottom. The rounded corners clipped both into slivers, and
 * the progress line kept running while sonner paused the timer on hover, so
 * it showed a dismissal that was not happening. Both are gone.
 *
 * Styling lives in globals.css under `.ng-toaster`: sonner's styles are
 * attribute selectors, and beating them needs plain CSS, not utilities.
 */

const ICONS = {
  success: <Icon name="check-circle-bold" size={20} />,
  error: <Icon name="danger-circle-bold" size={20} />,
  warning: <Icon name="danger-triangle-bold" size={20} />,
  info: <Icon name="info-circle-bold" size={20} />,
  loading: <span className="ng-toast-spinner" aria-hidden />,
  close: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
};

/** Mounted once, in the root layout. */
export function NgToaster() {
  return (
    <Toaster
      className="ng-toaster"
      position="top-center"
      duration={4200}
      closeButton
      gap={10}
      // Below the sticky header, so a toast never covers the cart count it
      // is confirming. Bottom is taken on mobile by the PDP and cart bars.
      offset={{ top: "84px" }}
      mobileOffset={{ top: "76px", left: "12px", right: "12px" }}
      icons={ICONS}
      style={
        {
          "--width": "380px",
          "--border-radius": "14px",
          "--normal-bg": "var(--ng-forest)",
          "--normal-border": "rgb(245 242 224 / 0.1)",
          "--normal-text": "var(--ng-cream)",
        } as CSSProperties
      }
    />
  );
}

interface Options {
  description?: ReactNode;
  /** Milliseconds; `null` keeps it up until dismissed. */
  duration?: number | null;
  action?: { label: string; onClick: () => void };
}

function opts(o: Options = {}) {
  return {
    description: o.description,
    duration: o.duration === null ? Infinity : o.duration,
    action: o.action,
  };
}

/** Same call shape as sonner, so either can be used at a call site. */
export const ngToast = {
  success: (title: ReactNode, o?: Options) => sonner.success(title, opts(o)),
  error: (title: ReactNode, o?: Options) => sonner.error(title, opts(o)),
  warn: (title: ReactNode, o?: Options) => sonner.warning(title, opts(o)),
  info: (title: ReactNode, o?: Options) => sonner.info(title, opts(o)),
  /** Stays until dismissed or replaced — for work that is still running. */
  loading: (title: ReactNode, o?: Options) => sonner.loading(title, opts({ ...o, duration: null })),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
