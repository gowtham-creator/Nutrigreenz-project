"use client";

import { toast as sonner } from "sonner";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Nutri Greenz notifications.
 *
 * Replaces sonner's `richColors` default, which paints a flat saturated block
 * per state — the same look every app using this library has, and nothing to do
 * with the brand. These are built from the brand tokens instead: cream paper, a
 * forest hairline, and a tinted glyph carrying the state so the message itself
 * stays on quiet ground and reads as type rather than as a coloured banner.
 *
 * The accent is a 3px rail down the leading edge, not a full wash. Colour
 * identifies the state at a glance; the copy does the explaining. A fully
 * tinted toast makes the text fight its own background, which is why an error
 * in the default style is harder to read than a plain one.
 *
 * A progress rail runs the width of the toast while it is alive, so a dismissal
 * is something you can see coming rather than a message vanishing mid-read.
 */

type Tone = "success" | "error" | "info" | "warn" | "loading";

const TONES: Record<
  Tone,
  { rail: string; glyphBg: string; glyph: string; icon: string; progress: string }
> = {
  success: {
    rail: "bg-ng-green-bright",
    glyphBg: "bg-ng-sage/50",
    glyph: "text-ng-forest",
    icon: "check-circle-bold",
    progress: "bg-ng-green-bright/45",
  },
  error: {
    rail: "bg-ng-danger",
    glyphBg: "bg-ng-danger/12",
    glyph: "text-ng-danger",
    icon: "close-circle-bold",
    progress: "bg-ng-danger/40",
  },
  warn: {
    rail: "bg-ng-amber",
    glyphBg: "bg-ng-amber/14",
    glyph: "text-ng-clay-deep",
    icon: "danger-triangle-bold",
    progress: "bg-ng-amber/45",
  },
  info: {
    rail: "bg-ng-forest",
    glyphBg: "bg-ng-sage/45",
    glyph: "text-ng-forest",
    icon: "info-circle-bold",
    progress: "bg-ng-forest/35",
  },
  loading: {
    rail: "bg-ng-clay",
    glyphBg: "bg-ng-clay/14",
    glyph: "text-ng-clay-deep",
    icon: "refresh-bold",
    progress: "bg-ng-clay/35",
  },
};

interface Options {
  description?: ReactNode;
  /** Milliseconds; `null` keeps it up until dismissed. */
  duration?: number | null;
  action?: { label: string; onClick: () => void };
}

function Body({
  tone,
  title,
  description,
  action,
  duration,
  onDismiss,
}: {
  tone: Tone;
  title: ReactNode;
  description?: ReactNode;
  action?: Options["action"];
  duration: number | null;
  onDismiss: () => void;
}) {
  const t = TONES[tone];
  const spinning = tone === "loading";

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-[min(400px,calc(100vw-2rem))] gap-3 overflow-hidden",
        "rounded-2xl border border-ng-line-soft bg-ng-paper/98 p-3.5 pl-4",
        "shadow-[0_10px_34px_-12px_rgba(20,51,31,0.30),0_2px_8px_-2px_rgba(20,51,31,0.12)]",
        "backdrop-blur-sm",
      )}
      role="status"
    >
      {/* Leading rail — the state, at a glance, without tinting the copy. */}
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", t.rail)} />

      <span
        aria-hidden
        className={cn("mt-px grid size-8 shrink-0 place-items-center rounded-full", t.glyphBg, t.glyph)}
      >
        <Icon name={t.icon} size={17} className={spinning ? "animate-spin" : undefined} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13.5px] font-semibold leading-snug text-ng-forest-deep">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ng-ink-muted">{description}</p>
        ) : null}

        {action ? (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss();
            }}
            className="mt-2 cursor-pointer rounded-full bg-ng-forest-deep px-3 py-1 text-[11.5px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest"
          >
            {action.label}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-0.5 -mt-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-ng-ink-soft transition-colors hover:bg-ng-line-soft hover:text-ng-forest"
      >
        <Icon name="close-circle-bold" size={14} />
      </button>

      {/*
        Time remaining. Animated on transform so it runs on the compositor —
        animating width would relayout the toast on every frame while it sits
        over live content.
      */}
      {duration ? (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-ng-line-soft/70">
          <span
            className={cn("ng-toast-progress block h-full origin-left", t.progress)}
            style={{ animationDuration: `${duration}ms` }}
          />
        </span>
      ) : null}
    </div>
  );
}

function show(tone: Tone, title: ReactNode, opts: Options = {}) {
  const duration = opts.duration === null ? null : (opts.duration ?? 4200);
  return sonner.custom(
    (id) => (
      <Body
        tone={tone}
        title={title}
        description={opts.description}
        action={opts.action}
        duration={duration}
        onDismiss={() => sonner.dismiss(id)}
      />
    ),
    { duration: duration ?? Infinity },
  );
}

/** Branded notifications. Same call shape as sonner, so swapping is mechanical. */
export const ngToast = {
  success: (title: ReactNode, opts?: Options) => show("success", title, opts),
  error: (title: ReactNode, opts?: Options) => show("error", title, opts),
  warn: (title: ReactNode, opts?: Options) => show("warn", title, opts),
  info: (title: ReactNode, opts?: Options) => show("info", title, opts),
  /** Stays until dismissed or replaced — for work that is still running. */
  loading: (title: ReactNode, opts?: Options) =>
    show("loading", title, { ...opts, duration: null }),
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
