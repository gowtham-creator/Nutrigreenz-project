"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  className?: string;
}

/** Controlled N-box OTP input with auto-advance, backspace, and paste support. */
export function OtpInput({ value, onChange, length = 6, className }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  function setChar(i: number, c: string) {
    const next = chars.slice();
    next[i] = c;
    onChange(next.join("").slice(0, length));
  }

  return (
    <div className={cn("flex gap-2 sm:gap-3", className)}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={c}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            setChar(i, d);
            if (d && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !chars[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (txt) {
              onChange(txt);
              refs.current[Math.min(txt.length, length - 1)]?.focus();
            }
          }}
          className="h-14 w-11 sm:w-14 rounded-xl border border-ng-line bg-ng-paper text-center font-display text-[22px] font-semibold text-ng-forest-deep outline-none transition-all duration-200 focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(102,191,115,0.25)]"
        />
      ))}
    </div>
  );
}
