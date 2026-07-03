"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-medium rounded-full transition-all duration-[420ms] ease-[cubic-bezier(0.25,0.6,0.2,1)] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ng-forest focus-visible:ring-offset-ng-paper will-change-transform active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary:
          "bg-ng-forest text-ng-paper hover:bg-ng-forest-deep hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(31,77,46,0.25)] hover:shadow-[0_8px_24px_rgba(31,77,46,0.32)]",
        secondary:
          "bg-ng-cream text-ng-forest border border-ng-line hover:border-ng-leaf hover:bg-ng-sage hover:-translate-y-0.5",
        outline:
          "bg-transparent text-ng-forest border-2 border-ng-forest hover:bg-ng-forest hover:text-ng-paper",
        ghost:
          "bg-transparent text-ng-forest hover:bg-ng-sage hover:text-ng-forest-deep",
        gold:
          "bg-ng-clay text-ng-soil hover:bg-ng-clay-deep hover:text-ng-paper hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(200,166,104,0.30)]",
        glass:
          "glass-strong text-ng-forest hover:-translate-y-0.5",
        danger:
          "bg-ng-danger text-ng-paper hover:bg-[#962F25] hover:-translate-y-0.5",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-6 text-[14px]",
        lg: "h-14 px-8 text-[16px]",
        xl: "h-16 px-10 text-[17px]",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", fullWidth: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
