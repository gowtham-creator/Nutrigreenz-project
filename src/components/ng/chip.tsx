"use client";

import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
}

export function Chip({
  active = false,
  icon,
  size = "md",
  className,
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "ng-chip",
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "",
        className,
      )}
      {...rest}
    >
      {icon ? <span className="text-ng-forest">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
