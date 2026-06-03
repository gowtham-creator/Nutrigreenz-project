import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "dark";
  float?: boolean;
  children: ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", float = true, children, ...rest }, ref) => {
    const base = variant === "dark" ? "glass-dark" : variant === "strong" ? "glass-strong" : "glass";
    return (
      <div
        ref={ref}
        className={cn(
          base,
          "rounded-2xl p-6",
          float && "ng-float",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
GlassCard.displayName = "GlassCard";

interface FloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tilt?: "none" | "soft" | "iso";
}

export const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(
  ({ className, children, tilt = "none", ...rest }, ref) => {
    const tiltClass = tilt === "iso" ? "tilt-iso" : tilt === "soft" ? "tilt-soft" : "";
    return (
      <div
        ref={ref}
        className={cn(
          "bg-ng-paper rounded-2xl border border-ng-line",
          "shadow-[var(--shadow-ng-float)]",
          "ng-float",
          tiltClass,
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
FloatingPanel.displayName = "FloatingPanel";
