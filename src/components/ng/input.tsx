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
    /*
     * `React.useId()` is called UNCONDITIONALLY.
     *
     * This was `id ?? React.useId()`, which short-circuits: the hook only ran
     * when no `id` was passed. Any component that renders an Input sometimes
     * with an id and sometimes without changes its hook order between renders,
     * and React throws "rendered fewer hooks than expected" and unmounts the
     * tree. Checkout, auth and the admin forms all use this component.
     *
     * The generated id is discarded when a caller supplies one. A wasted string
     * is the entire cost of not crashing.
     */
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-[13px] font-semibold text-ng-ink">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-2 h-12 rounded-xl bg-ng-paper border border-ng-line pl-4 pr-2 has-[input:only-of-type]:pr-4",
            "focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200",
            error && "border-ng-danger focus-within:border-ng-danger focus-within:shadow-[0_0_0_3px_rgba(178,58,46,0.18)]",
          )}
        >
          {prefix ? (
            <span className="inline-flex size-5 shrink-0 items-center justify-center text-ng-ink-soft">
              {prefix}
            </span>
          ) : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "flex-1 bg-transparent outline-none text-[15px] text-ng-ink placeholder:text-ng-ink-soft",
              className,
            )}
            {...rest}
          />
          {/*
            Sized and centred rather than free-flowing. As a bare span the
            control sat on the text baseline and its own focus ring could break
            past the field's rounded edge — most visible on the passcode eye,
            which appeared to hang outside the box.
          */}
          {suffix ? (
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ng-ink-soft [&>button]:inline-flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg">
              {suffix}
            </span>
          ) : null}
        </div>
        {hint && !error ? (
          <p className="text-[12px] font-medium text-ng-ink-soft">{hint}</p>
        ) : null}
        {error ? <p className="text-[12px] font-medium text-ng-danger">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = "Input";
