"use client";

import Link from "next/link";
import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
  /**
   * Render as a link instead of a button.
   *
   * Category chips point at real pages — each has its own hero, blurb and
   * metadata — so they must be anchors: navigable, openable in a new tab, and
   * crawlable. As buttons they swapped the grid in place and left the previous
   * hero above it, which read as the page having failed to respond.
   */
  href?: string;
}

export function Chip({
  active = false,
  icon,
  size = "md",
  className,
  children,
  href,
  ...rest
}: ChipProps) {
  const classes = cn("ng-chip", size === "sm" ? "px-3 py-1.5 text-[12px]" : "", className);
  const inner = (
    <>
      {icon ? <span className="text-ng-forest">{icon}</span> : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} data-active={active} className={classes} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" data-active={active} className={classes} {...rest}>
      {inner}
    </button>
  );
}
