"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Keycap — a single key, drawn the way the key is actually labelled.
 *
 * ── Why the symbols, and why they are not hardcoded ───────────────────────
 *
 * The legend said "esc", "↵" and "⌘K" spelled out in text. Two problems with
 * that, one cosmetic and one a correctness bug.
 *
 * The cosmetic one: macOS labels these keys with specific glyphs, and every
 * Mac user reads ⎋ and ↩ faster than the words, because that is what is
 * printed on the keyboard in front of them. Those glyphs are Unicode — ⌘
 * U+2318, ⎋ U+238B, ↩ U+21A9 — not artwork, so they render at any size, in any
 * colour, with no asset to ship.
 *
 * The bug: ⌘K is wrong on Windows and Linux, where the shortcut this component
 * documents is Ctrl+K. A legend that names a key the visitor does not have is
 * worse than no legend. The platform is detected and the label follows it —
 * "esc" rather than ⎋, "enter" rather than ↩, "Ctrl" rather than ⌘.
 *
 * ── Why useSyncExternalStore and not an effect ────────────────────────────
 *
 * The server has no idea what the visitor is typing on, so this has to be read
 * on the client. Reading `navigator` during render would produce markup that
 * disagrees with the server's and trip a hydration mismatch; reading it in an
 * effect and calling setState is a cascading render, which is what the
 * `react-hooks/set-state-in-effect` rule exists to catch.
 *
 * `useSyncExternalStore` is the API for exactly this shape — a value the server
 * cannot know and the client can read synchronously. It takes an explicit
 * server snapshot (`false`, so the server renders the non-Mac labels) and a
 * client snapshot, and React reconciles the two without a mismatch and without
 * an extra render pass. The subscribe function is a no-op because a keyboard
 * does not change platform mid-session.
 */

/** Nothing to subscribe to: the platform is fixed for the life of the page. */
const subscribe = () => () => {};

const getIsMacSnapshot = () =>
  // `navigator.platform` is deprecated but remains the only thing that reports
  // the *keyboard* rather than the rendering engine. The userAgent fallback
  // covers browsers that have already dropped it.
  /mac|iphone|ipad|ipod/i.test(`${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`);

export function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, getIsMacSnapshot, () => false);
}

export function Keycap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        // A key, not a chip: a light face, a darker edge, and a hairline of
        // shadow under it so it reads as something that could be pressed.
        "inline-flex min-w-[1.55rem] items-center justify-center rounded-[5px] border border-ng-line",
        "bg-gradient-to-b from-ng-white to-ng-cream px-1.5 py-[3px]",
        "font-sans text-[11px] font-medium leading-none text-ng-ink-muted",
        "shadow-[0_1px_0_0_var(--ng-line)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * The modifier for this platform's primary shortcut — ⌘ on a Mac, Ctrl
 * everywhere else. Exported so a caller can label a shortcut correctly without
 * repeating the detection.
 */
export function ModifierKey({ className }: { className?: string }) {
  const isMac = useIsMac();
  return <Keycap className={className}>{isMac ? "⌘" : "Ctrl"}</Keycap>;
}

/**
 * Escape.
 *
 * Spelled out on every platform, macOS included, which is the one place this
 * component does NOT use the Apple glyph. Two reasons, and the second is the
 * decisive one:
 *
 * Apple uses ⎋ (U+238B) in menus, but the physical key on every Mac keyboard
 * shipped this decade is printed "esc" — and this legend describes a key the
 * reader is about to press, not a menu item they are reading.
 *
 * More concretely, ⎋ draws as a broken circle with a north-west arrow, which is
 * very nearly the history glyph used on the recent-search rows a few pixels
 * above it in this same panel. Two near-identical circular marks meaning
 * completely different things, in one small surface, is worse than a word.
 */
export function EscKey({ className }: { className?: string }) {
  return <Keycap className={className}>esc</Keycap>;
}

/** Return/Enter — ↩ on a Mac, the word elsewhere. */
export function EnterKey({ className }: { className?: string }) {
  const isMac = useIsMac();
  return (
    <Keycap className={className}>
      <span className={isMac ? "text-[13px]" : undefined}>{isMac ? "↩" : "enter"}</span>
    </Keycap>
  );
}
