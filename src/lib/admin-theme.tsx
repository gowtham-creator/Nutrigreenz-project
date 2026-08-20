"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

/**
 * Light/dark theme for the operator console.
 *
 * ── Scoped to the admin, deliberately ─────────────────────────────────────
 *
 * The flag lands on the `.ng-admin` wrapper rather than on `<html>`, so the
 * storefront is untouched. That is not a limitation: the shop is brand surface,
 * photographed against a warm cream ground, and a dark storefront would be a
 * different product. The console is a tool, and a tool should suit the room —
 * several operators work evenings.
 *
 * ── Three states, not two ─────────────────────────────────────────────────
 *
 * `system` is the default and a real state, not a synonym for light. An
 * operator whose OS is dark should get a dark console without asking, and
 * should keep following the OS when it flips at sunset. Choosing light or dark
 * pins it and stops the following. `system` is stored as the ABSENCE of the
 * key, so a fresh browser and a reset behave identically.
 *
 * ── Why an external store rather than useState + useEffect ────────────────
 *
 * The theme is a value the SERVER cannot know: it lives in localStorage and in
 * an OS media query. Reading it during render would trip a hydration mismatch;
 * reading it in an effect and calling setState is the cascading render that
 * `react-hooks/set-state-in-effect` exists to catch, and it also means one
 * frame painted in the wrong theme.
 *
 * `useSyncExternalStore` is the API for exactly this shape. It takes an
 * explicit server snapshot ("light", matching what the markup assumes) and a
 * client snapshot read synchronously during hydration, so React reconciles the
 * two without a mismatch and without an extra pass. The store below is the
 * single source of truth; the media-query listener and the storage write both
 * flow through it.
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ng-admin-theme";

/* ── the store ─────────────────────────────────────────────────────────── */

let listeners: Array<() => void> = [];
/** Cached so `getSnapshot` is referentially stable between renders. */
let snapshot: { choice: ThemeChoice; resolved: ResolvedTheme } = {
  choice: "system",
  resolved: "light",
};

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system"; // private mode — follow the system for this session
  }
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? (prefersDark() ? "dark" : "light") : choice;
}

/** Paint it. The attribute is what every CSS rule keys on. */
function apply(resolved: ResolvedTheme) {
  const root = document.querySelector(".ng-admin");
  if (root) root.setAttribute("data-theme", resolved);
}

function recompute() {
  const choice = readChoice();
  const resolved = resolve(choice);
  if (choice === snapshot.choice && resolved === snapshot.resolved) return;
  snapshot = { choice, resolved };
  apply(resolved);
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.push(onChange);

  // Follow the OS while, and only while, no explicit choice is pinned.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => { if (snapshot.choice === "system") recompute(); };
  mq.addEventListener("change", onMedia);

  // Another tab changing the theme should move this one too — an operator with
  // the console open twice should not see two different consoles.
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) recompute(); };
  window.addEventListener("storage", onStorage);

  // First subscription: adopt whatever the pre-paint script already decided.
  recompute();

  return () => {
    listeners = listeners.filter((l) => l !== onChange);
    mq.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => snapshot;
/* The server assumes light; the pre-paint script corrects it before anyone
   sees a frame, so this never causes a visible flash. */
const SERVER_SNAPSHOT: { choice: ThemeChoice; resolved: ResolvedTheme } = {
  choice: "system",
  resolved: "light",
};
const getServerSnapshot = () => SERVER_SNAPSHOT;

/* ── public API ────────────────────────────────────────────────────────── */

export function useAdminTheme() {
  const { choice, resolved } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the choice holds for this session only */
    }
    recompute();
  }, []);

  /*
   * Three states in the cycle, not two — and `system` has to be one of them.
   *
   * This previously flipped between light and dark only. That meant the first
   * tap on any device wrote an explicit choice to localStorage and the console
   * stopped following the OS there PERMANENTLY, with no way back: a Mac set to
   * switch at sunset, and an iPad on auto, both froze on whatever had been
   * tapped weeks earlier. The theme looked broken across devices because the
   * default state had become unreachable.
   *
   * The order is chosen so the first tap always CHANGES something. Going
   * system -> "whatever the OS already is" would look like a dead control, so
   * the cycle leaves `system` for the opposite of what is currently on screen:
   *
   *   OS dark:   system -> light -> dark  -> system
   *   OS light:  system -> dark  -> light -> system
   */
  const toggle = useCallback(() => {
    const osDark = prefersDark();
    const firstStop: ResolvedTheme = osDark ? "light" : "dark";
    if (choice === "system") return setChoice(firstStop);
    if (choice === firstStop) return setChoice(osDark ? "dark" : "light");
    return setChoice("system");
  }, [choice, setChoice]);

  /** Human-readable current mode, for the control's label and tooltip. */
  const label =
    choice === "system"
      ? `Following your device theme (${resolved})`
      : `Theme pinned to ${choice}`;

  return { choice, resolved, setChoice, toggle, label };
}

/**
 * Applies the theme before first paint.
 *
 * Rendered inside the admin layout's markup so it runs synchronously, ahead of
 * the React bundle. Without it an operator on dark sees a full cream console
 * for as long as hydration takes and then a hard flip — the flash of wrong
 * theme that makes a toggle feel broken even when it works.
 */
export function AdminThemeScript() {
  const js = `(function(){try{
    var c = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var d = c === 'dark' || (c !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.currentScript && document.currentScript.parentElement;
    if (el) el.setAttribute('data-theme', d ? 'dark' : 'light');
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

/**
 * Owns the OS-follow subscription for the whole console.
 *
 * This used to be a no-op passthrough, on the reasoning that the store is
 * module-level and needs no context. That was wrong in one specific and
 * user-visible way: `subscribe()` — which installs the
 * `prefers-color-scheme` listener — only runs while some component is
 * actually calling `useAdminTheme`. The only caller was the toggle, and the
 * toggle lives in the admin header.
 *
 * So on the sign-in, forgot and reset screens there was NO listener at all.
 * The pre-paint script set the right theme on load, and then the page stopped
 * tracking the device: a Mac flipping to dark at sunset, or an iPad on auto,
 * left the console frozen on whatever it had been at page load. It looked
 * exactly like "the theme does not sync with my devices".
 *
 * Subscribing here means the listener exists wherever the provider is mounted,
 * which is the entire admin layout, whether or not a toggle is on screen.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
  useAdminTheme();
  return <>{children}</>;
}
