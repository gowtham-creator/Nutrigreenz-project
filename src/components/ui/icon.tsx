"use client";

import { Icon as Iconify, addCollection } from "@iconify/react";
import { cn } from "@/lib/utils";
import iconSubset from "./icon-subset.json";

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
