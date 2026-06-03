import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types/nutrigreenz";

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  size?: "sm" | "md";
}

const TONE_STYLES: Record<Tone, string> = {
  forest: "bg-ng-forest text-ng-paper",
  leaf: "bg-ng-leaf text-ng-forest-deep",
  sage: "bg-ng-sage text-ng-forest-deep",
  cream: "bg-ng-cream-deep text-ng-soil",
  clay: "bg-ng-clay text-ng-soil",
  terracotta: "bg-ng-terracotta text-ng-paper",
  soil: "bg-ng-soil text-ng-cream",
  ink: "bg-ng-ink text-ng-paper",
};

export function Badge({ children, tone = "leaf", className, size = "sm" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium uppercase tracking-wider",
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[12px]",
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
