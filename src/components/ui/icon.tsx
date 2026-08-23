"use client";

import { Icon as Iconify, addCollection } from "@iconify/react";
import { cn } from "@/lib/utils";
import iconSubset from "./icon-subset.json";
import { UiIcon, UI_ICON_NAMES, type UiIconName } from "@/components/ui/ui-icon";

/**
 * App icon — Solar icon set via Iconify, served OFFLINE.
 *
 * The icon data for every name this app uses is bundled locally (see
 * `scripts/build-icon-subset.mjs`) and registered here at module load. Without
 * this, `@iconify/react` lazy-fetches each icon from the public Iconify CDN at
 * runtime, which means a network round-trip before any icon paints, no icons at
 * all on networks that block that host, and a third-party request per visitor.
 *
 * Bundling the whole Solar set is not viable (6.2 MB); the generated subset is
 * ~150 KB and covers the ~210 icons actually referenced. Re-run the script when
 * new icons are introduced — it reports any name it cannot resolve.
 *
 * A name missing from the subset still renders via the CDN fallback rather than
 * disappearing, so a newly-added icon degrades gracefully until the script runs.
 */
type IconifyJSON = Parameters<typeof addCollection>[0];
for (const collection of iconSubset as unknown as IconifyJSON[]) {
  addCollection(collection);
}

export interface IconProps {
  /** Solar icon name, e.g. "home-2-bold" or fully-qualified "solar:home-2-bold". */
  name: string;
  /** Pixel size (applied to width + height). Defaults to 20. */
  size?: number;
  className?: string;
  /** Accessible label; when omitted the icon is decorative (aria-hidden). */
  label?: string;
}

/**
 * App icon. Usage: <Icon name="bag-4-bold" /> renders `solar:bag-4-bold`.
 */
export function Icon({ name, size = 20, className, label }: IconProps) {
  /*
   * A supplied mark wins, wherever the name arrives from.
   *
   * Most icons are passed as DATA — `icon: "customers"` on a nav row, a
   * permission, a stat tile — and rendered by some component further down that
   * only knew about Solar. So swapping the data to a supplied name blanked the
   * icon silently: the name resolved to no Solar glyph and Iconify rendered
   * nothing. That failure has now happened four times in this project, each
   * time fixed at one call site while the next one waited.
   *
   * Resolving it here fixes the class instead. `Icon` is the single funnel every
   * string-prop path already goes through, so a supplied name works from
   * anywhere without each consumer having to know which family it belongs to.
   */
  if (UI_ICON_NAMES.has(name)) {
    return <UiIcon name={name as UiIconName} size={size} className={className} label={label} />;
  }
  const icon = name.includes(":") ? name : `solar:${name}`;
  return (
    <Iconify
      icon={icon}
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

export default Icon;
