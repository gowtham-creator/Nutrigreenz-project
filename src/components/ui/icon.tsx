"use client";

import { Icon as Iconify } from "@iconify/react";
import { cn } from "@/lib/utils";

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
 * App icon — Solar icon set via Iconify.
 * Usage: <Icon name="bag-4-bold" /> renders `solar:bag-4-bold`.
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
