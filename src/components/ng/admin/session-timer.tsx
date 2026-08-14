"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAdminRole } from "@/lib/admin-auth";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";

/**
 * The operator session clock: one owner for the idle deadline, the heartbeat,
 * the automatic sign-out, and the countdown the header shows.
 *
 * ── Why these are one component and not two ───────────────────────────────
 *
 * A visible countdown is only worth having if it is the SAME clock that signs
 * you out. Running a second timer beside the existing idle guard would give two
 * deadlines that drift apart, and the number on screen would be a decoration
 * that happens to look like a fact — the worst kind of security UI, because it
 * is trusted and wrong. So the provider owns the deadline, the sign-out reads
 * it, and the display subscribes to it.
 *
 * ── What the number means ─────────────────────────────────────────────────
 *
 * Time until sign-out IF THE OPERATOR STOPS NOW. Any activity — mouse, key,
 * click, scroll — slides the server session forward via the heartbeat and
 * resets this deadline with it, so the countdown climbing back to full is the
 * timer working, not a glitch. That is what an idle timeout is.
 *
 * ── On the two windows ────────────────────────────────────────────────────
 *
 * The client idles out at 30 minutes; the signed session token is good for 35
 * (ADMIN_SESSION_TTL_SECONDS). The gap is deliberate — the browser gives up
 * first, so an operator is signed out by this timer rather than discovering it
 * from a failed request — and the countdown therefore tracks the 30, which is
 * the deadline that actually ends the session.
 *
 * If this component never runs (tab closed, JavaScript disabled, the timer
 * killed by a background throttle) the session still dies: the token carries
 * its own `expiresAt` and the proxy rejects it. The countdown is the courtesy,
 * not the control.
 */

/** Idle window before automatic sign-out. */
const IDLE_MS = 30 * 60 * 1000;
/** Ping the heartbeat at most this often, however busy the mouse is. */
const HEARTBEAT_THROTTLE_MS = 60 * 1000;
/** How often the visible clock re-renders. */
const TICK_MS = 1000;
/** Below this, the countdown starts warning. */
const WARN_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

function isAuthScreen(pathname: string): boolean {
  return pathname === "/admin/login" || pathname === "/admin/forgot" || pathname === "/login";
}

interface SessionState {
  /** Milliseconds until automatic sign-out, or null when not tracking. */
  msRemaining: number | null;
}

const Ctx = createContext<SessionState>({ msRemaining: null });

/** The header countdown reads this. */
export function useAdminSession(): SessionState {
  return useContext(Ctx);
}

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [msRemaining, setMsRemaining] = useState<number | null>(null);

  // Guards the sign-out so a racing timer and event cannot both fire it.
  const signedOut = useRef(false);
  // The single source of truth for when this session ends.
  const deadline = useRef<number>(0);
  const lastPing = useRef(0);

  const active = !isAuthScreen(pathname);

  const signOut = useCallback(async () => {
    if (signedOut.current) return;
    signedOut.current = true;
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Ignore — still bounce to login so a stale UI cannot be used.
    }
    router.replace("/admin/login?reason=timeout");
  }, [router]);

  useEffect(() => {
    if (!active) {
      setMsRemaining(null);
      return;
    }
    if (!getAdminRole()) {
      setMsRemaining(null);
      return; // no readable session → nothing to protect or display
    }

    signedOut.current = false;
    deadline.current = Date.now() + IDLE_MS;

    const bump = () => {
      if (signedOut.current) return;
      deadline.current = Date.now() + IDLE_MS;
      const now = Date.now();
      if (now - lastPing.current >= HEARTBEAT_THROTTLE_MS) {
        lastPing.current = now;
        // Slides the SERVER session so an active operator is never signed out.
        void fetch("/api/admin/heartbeat", { method: "POST" }).catch(() => {});
      }
    };

    /*
     * One interval drives both the display and the sign-out, rather than a
     * setTimeout for the deadline and a separate interval for the clock. A
     * backgrounded tab throttles timers unpredictably; comparing against a
     * wall-clock deadline each tick means a throttled tab signs out late but
     * never early, and never fails to notice it is past due.
     */
    const tick = () => {
      const left = deadline.current - Date.now();
      setMsRemaining(Math.max(0, left));
      if (left <= 0) void signOut();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }
    bump();
    tick();
    const interval = setInterval(tick, TICK_MS);

    return () => {
      clearInterval(interval);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, bump);
    };
  }, [active, signOut]);

  const value = useMemo(() => ({ msRemaining }), [msRemaining]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * The countdown itself, for the portal header.
 *
 * Renders nothing until the provider has a deadline, so it never flashes a
 * placeholder time that was never true.
 */
export function SessionCountdown({ className }: { className?: string }) {
  const { msRemaining } = useAdminSession();
  if (msRemaining == null) return null;

  const total = Math.ceil(msRemaining / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const warning = msRemaining <= WARN_MS;

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1",
        warning
          ? "border-ng-terracotta/40 bg-ng-terracotta/10 text-ng-terracotta"
          : "border-ng-line bg-ng-paper text-ng-ink-muted",
        className,
      )}
      /* The clock is decorative to a screen reader — it re-reads every second
         and would talk over everything else. The label carries the meaning, and
         `aria-live` is deliberately absent for the same reason. */
      title={`Signed out automatically after ${Math.round(IDLE_MS / 60000)} minutes of inactivity`}
    >
      <UiIcon name="caution" size={12} className={warning ? "" : "opacity-0"} aria-hidden />
      <span className="sr-only">Time left in this session:</span>
      <span className="font-mono text-[12px] font-semibold tabular-nums leading-none">
        {pad(mins)}:{pad(secs)}
      </span>
    </div>
  );
}
