"use client";

import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search the pantry…", className }: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ng-ink-muted">
        <UiIcon name="search" size={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        className="w-full rounded-full border border-ng-line bg-ng-paper py-3 pl-11 pr-10 text-[14px] text-ng-ink placeholder:text-ng-ink-muted/70 outline-none transition-colors focus:border-ng-leaf focus:ring-2 focus:ring-ng-leaf/20"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-ng-ink-muted hover:bg-ng-sage hover:text-ng-forest transition-colors"
        >
          <Icon name="close-circle-linear" size={18} />
        </button>
      ) : null}
    </div>
  );
}
