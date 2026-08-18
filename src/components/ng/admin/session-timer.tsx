"use client";

import {
  createContext,
  useSyncExternalStore,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAdminRole, getAdminSessionExpiry } from "@/lib/admin-auth";
import { UiIcon } from "@/components/ui/ui-icon";
import { cn } from "@/lib/utils";

/**
 * The operator session clock: a FIXED lifetime, counted down in the header and
 * enforced by signing the operator out when it reaches zero.
 *
 * ── Fixed, not idle ───────────────────────────────────────────────────────
 *
 * The portal used to run an idle timeout: any mouse move, key, click or scroll
 * pushed the deadline out another 30 minutes, and a heartbeat minted a fresh
 * token so the server agreed. An operator who kept working was never signed
 * out — which is convenient, and is also why a session left open on an
 * unattended machine could live indefinitely as long as anything nudged the
 * page.
 *
 * The session now ends 30 minutes after sign-in, whatever happens in between.
 * Nothing an operator does extends it. That is a real ceiling on how long a
 * stolen laptop, a shared desk or a forgotten tab stays useful, and it is the
 * behaviour a CERT-In reviewer expects to find on an admin surface.
 *
 * ── Why the deadline comes from a cookie ──────────────────────────────────
 *
 * Starting a 30-minute clock when this component mounts would restart the
 * session on every refresh, every new tab and every hard navigation — the
 * timer would say 30:00 while the real session had four minutes left. So the
 * login routes publish the absolute deadline in a readable `ng_admin_exp`
 * cookie and this counts down to THAT. Refresh, reopen, or open a second tab:
 * every one of them shows the same remaining time, because they are all
 * reading the same instant.
 *
 * The cookie is display-only. It is not httpOnly precisely so the countdown can
 * read it, and editing it moves a number on screen and nothing else: the expiry
 * the server enforces is signed inside `ng_admin` and re-checked on every
 * request. A forged cookie buys a longer-looking clock and a 401.
 */

/** How often the visible clock re-renders. */
const TICK_MS = 1000;
/** Below this, the countdown starts warning. */
const WARN_MS = 5 * 60 * 1000;
/**
 * How often to confirm the session is still alive server-side.
 *
 * Not a keep-alive — it extends nothing. It exists so a tab left open finds out
 * about a "sign out everywhere" from another device, or a revoked account,
 * without waiting for the operator's next navigation.
 */
const LIVENESS_MS = 2 * 60 * 1000;

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

/*
 * The deadline is a client-only value the server cannot know, so it is read
 * through useSyncExternalStore rather than pulled into state inside an effect.
 * Reading it during render would mismatch on hydration; reading it in an effect
 * and calling setState is the cascading render `react-hooks/set-state-in-effect`
 * exists to catch. This is the API for exactly this shape.
 */
const subscribeToCookie = () => () => {};

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Ticks once a second; `msRemaining` is derived from it, never stored.
  const [now, setNow] = useState<number | null>(null);

  const expiresAt = useSyncExternalStore(
    subscribeToCookie,
    () => (getAdminRole() ? getAdminSessionExpiry() : null),
    () => null,
  );

  // Guards the sign-out so a racing tick and a 401 cannot both fire it.
  const signedOut = useRef(false);

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
    // No session, an auth screen, or a session minted before this cookie
    // existed: nothing to count. The signed token still expires on its own.
    if (!active || !expiresAt) return;

    signedOut.current = false;

    /*
     * One interval drives both the display and the sign-out, comparing against
     * a wall-clock deadline rather than counting down a stored number. A
     * backgrounded tab throttles timers unpredictably and a laptop that sleeps
     * stops them entirely; measuring the gap to a fixed instant each tick means
     * a throttled or resumed tab signs out late but never early, and never
     * fails to notice it is already past due.
     */
    const tick = () => {
      const stamp = Date.now();
      setNow(stamp);
      if (expiresAt - stamp <= 0) void signOut();
    };

    tick();
    const clock = setInterval(tick, TICK_MS);

    // Liveness only. A 401 means the session died elsewhere (revoked, or signed
    // out from another device), so stop showing a portal that cannot act.
    const liveness = setInterval(() => {
      void fetch("/api/admin/heartbeat", { method: "POST" })
        .then((res) => {
          if (res.status === 401) void signOut();
        })
        .catch(() => {});
    }, LIVENESS_MS);

    return () => {
      clearInterval(clock);
      clearInterval(liveness);
    };
  }, [active, expiresAt, signOut]);

  const value = useMemo(
    () => ({
      msRemaining:
        active && expiresAt && now != null ? Math.max(0, expiresAt - now) : null,
    }),
    [active, expiresAt, now],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * A live analog clock face showing the time REMAINING, not the time of day.
 *
 * Beside a countdown, the wall clock would be the less useful of the two
 * readings — the operator can see the wall clock on their own machine. What
 * they cannot see at a glance is how much session is left, so the hands encode
 * that: the short hand carries minutes over a 60-minute face, the long hand
 * carries seconds. Both wind anticlockwise back to twelve as the session
 * drains, and both stand straight up at 00:00.
 *
 * The long hand moves every second, which is the point — a static clock glyph
 * beside a changing number reads as decoration, and this one is the reason you
 * can tell at a glance that the session is still being counted.
 *
 * Drawn rather than taken from the icon set because no icon set ships a clock
 * whose hands you can drive. `currentColor` throughout, so it turns terracotta
 * with the rest of the pill when the session is nearly out.
 */
function ClockFace({ mins, secs }: { mins: number; secs: number }) {
  /*
   * One hand, not two — and that is the whole design.
   *
   * The obvious build is an hour hand and a minute hand. At 13px it fails: any
   * two strokes drawn from a shared centre line up roughly opposite twice an
   * hour, and two opposed strokes through a circle read as ⊖ or ⊘ — a minus
   * sign, or the universal "prohibited" mark. Beside a session timer that says
   * precisely the wrong thing, and no amount of length or weight difference
   * fixes it, because the failure is geometric rather than visual. Both were
   * built and compared at size before this was settled.
   *
   * So the minutes move to the RIM as a depleting arc, and only the seconds
   * hand is drawn. Nothing can ever form a bar, the glyph reads as a clock at
   * every value, and the arc says something the digits do not: how much of the
   * session is gone, without having to know how long it started at.
   */
  const secondAngle = (secs / 60) * 360;

  const R = 8.4;
  const CIRC = 2 * Math.PI * R;
  // Fraction of the current hour still to run. Wraps with the minutes so a
  // longer session simply starts the rim full again rather than overflowing.
  const remaining = ((mins % 60) * 60 + secs) / 3600;

  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
      aria-hidden
    >
      {/* The dial: a full ring at low opacity, so the glyph still reads as a
          clock once the arc above it has drained away to nothing. */}
      <circle cx="12" cy="12" r={R} stroke="currentColor" strokeWidth="1.6" opacity="0.3" />
      {/* Minutes, as a rim arc that empties clockwise from twelve. */}
      <circle
        cx="12" cy="12" r={R}
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - remaining)}
        transform="rotate(-90 12 12)"
      />
      {/* Seconds — the part that visibly ticks. */}
      <line
        x1="12" y1="12" x2="12" y2="6.9"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
        transform={`rotate(${secondAngle} 12 12)`}
      />
      <circle cx="12" cy="12" r="1.05" fill="currentColor" />
    </svg>
  );
}

/**
 * The countdown itself, for the portal header.
 *
 * Renders nothing until there is a real deadline to show, so it never displays
 * a placeholder time that was never true.
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
      /* Decorative to a screen reader: it changes every second and would talk
         over everything else. The title and the sr-only label carry the meaning,
         and `aria-live` is deliberately absent for the same reason. */
      title="This session ends at 00:00 and cannot be extended. Sign in again to continue."
    >
      {/* The clock reads normally; the caution mark takes over once the session
          is nearly out, because at that point the message is "act now" rather
          than "here is the remaining time". This slot previously held an
          `opacity-0` caution icon purely to reserve the space — the clock now
          does that job while actually saying something. */}
      {warning ? (
        <UiIcon name="caution" size={12} aria-hidden />
      ) : (
        <ClockFace mins={mins} secs={secs} />
      )}
      <span className="sr-only">Time left in this session:</span>
      <span className="font-mono text-[12px] font-semibold tabular-nums leading-none">
        {pad(mins)}:{pad(secs)}
      </span>
    </div>
  );
}
