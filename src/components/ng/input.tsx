"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, prefix, suffix, id, ...rest }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-[13px] font-medium text-ng-ink-muted">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-2 h-12 px-4 rounded-xl bg-ng-paper border border-ng-line",
            "focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200",
            error && "border-ng-danger focus-within:border-ng-danger focus-within:shadow-[0_0_0_3px_rgba(178,58,46,0.18)]",
          )}
        >
          {prefix ? <span className="text-ng-ink-soft">{prefix}</span> : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "flex-1 bg-transparent outline-none text-[15px] text-ng-ink placeholder:text-ng-ink-soft",
              className,
            )}
            {...rest}
          />
          {suffix ? <span className="text-ng-ink-soft">{suffix}</span> : null}
        </div>
        {hint && !error ? (
          <p className="text-[12px] text-ng-ink-soft">{hint}</p>
        ) : null}
        {error ? <p className="text-[12px] text-ng-danger">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = "Input";
