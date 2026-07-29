"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

type Setup = { secret: string; qrDataUri: string };

/**
 * Fired by any surface that wants to start authenticator enrolment on demand —
 * currently the Security section of /admin/profile, whose toggle cannot enable
 * TOTP directly (that would gate sign-in behind an app that was never set up).
 * Dispatching this opens the same modal the post-login prompt uses.
 */
export const ENROLL_AUTHENTICATOR_EVENT = "ng:enroll-authenticator";

/** Fired after a successful enrolment so open screens can refresh their state. */
export const AUTHENTICATOR_ENROLLED_EVENT = "ng:authenticator-enrolled";

/**
 * Post-login authenticator (TOTP) enrollment prompt — Zoho-style.
 *
 * Mounted across the admin portal: on load it asks /api/admin/me/totp whether the
 * signed-in operator still needs to set up an authenticator (and hasn't snoozed
 * the prompt). If so it fetches a fresh QR + key and opens a modal. The operator
 * can enrol now, "Remind me later" (re-prompts in 2 days) or "Skip for now"
 * (7 days). On the login screen the status call 401s, so nothing shows.
 */
export function AuthenticatorEnrollPrompt() {
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/me/totp");
        if (!r.ok || !alive) return;
        const d = await r.json();
        if (!d?.promptDue) return;
        const s = await fetch("/api/admin/me/totp/setup", { method: "POST" });
        if (!s.ok || !alive) return;
        const sd = await s.json();
        if (alive && sd?.qrDataUri) {
          setSetup({ secret: sd.secret as string, qrDataUri: sd.qrDataUri as string });
          setOpen(true);
        }
      } catch {
        /* best-effort — never block the portal */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // On-demand enrolment: the profile toggle asks for the QR rather than setting
  // the factor itself. Fetches a fresh secret and opens the same modal, ignoring
  // the snooze that governs the automatic post-login prompt.
  useEffect(() => {
    async function onRequest() {
      try {
        const s = await fetch("/api/admin/me/totp/setup", { method: "POST" });
        if (!s.ok) {
          const d = await s.json().catch(() => ({}));
          toast.error(
            d?.error === "already-enrolled"
              ? "Authenticator is already set up."
              : "Couldn't start setup — try again.",
          );
          return;
        }
        const sd = await s.json();
        if (sd?.qrDataUri) {
          setSetup({ secret: sd.secret as string, qrDataUri: sd.qrDataUri as string });
          setCode("");
          setOpen(true);
        }
      } catch {
        toast.error("Couldn't start setup — try again.");
      }
    }
    window.addEventListener(ENROLL_AUTHENTICATOR_EVENT, onRequest);
    return () => window.removeEventListener(ENROLL_AUTHENTICATOR_EVENT, onRequest);
  }, []);

  async function snooze(mode: "skip" | "later") {
    setOpen(false);
    try {
      await fetch("/api/admin/me/totp/snooze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch {
      /* non-fatal */
    }
  }

  async function confirm() {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) {
      toast.error("Enter the 6-digit code from your app.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/me/totp/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      if (r.ok) {
        toast.success("Authenticator enabled", {
          description: "You'll use it at your next sign-in.",
        });
        setOpen(false);
        // Let an open Security section flip its toggle without a page reload.
        window.dispatchEvent(new Event(AUTHENTICATOR_ENROLLED_EVENT));
      } else {
        toast.error("That code didn't match", {
          description: "Check your phone's time and try the current code.",
        });
      }
    } catch {
      toast.error("Couldn't verify — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !setup) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ng-forest-deep/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Set up an authenticator app"
      onKeyDown={(e) => {
        if (e.key === "Escape") void snooze("later");
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[0_24px_64px_rgba(31,77,46,0.28)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ng-forest/10 text-ng-forest">
            <Icon name="shield-check-bold" size={20} />
          </span>
          <div>
            <h2 className="font-display text-[19px] leading-tight text-ng-forest-deep">Secure your account</h2>
            <p className="text-[12.5px] text-ng-ink-muted">Add an authenticator app for sign-in.</p>
          </div>
        </div>

        <ol className="mt-4 space-y-1.5 text-[13px] text-ng-ink">
          <li className="flex gap-2">
            <span className="font-semibold text-ng-forest">1.</span> Open{" "}
            <span className="font-semibold">Google</span> or <span className="font-semibold">Microsoft Authenticator</span>.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-ng-forest">2.</span> Scan this QR (or enter the key).
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-ng-forest">3.</span> Enter the 6-digit code it shows.
          </li>
        </ol>

        <div className="mt-4 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrDataUri}
            alt="Authenticator QR code"
            className="h-44 w-44 rounded-xl border border-ng-line-soft bg-white p-1"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-[11.5px] font-semibold text-ng-forest hover:underline"
          >
            {showKey ? "Hide key" : "Can't scan? Enter key"}
          </button>
          {showKey ? (
            <code className="select-all break-all rounded-lg bg-ng-cream px-3 py-1.5 font-mono text-[12px] tracking-wider text-ng-ink">
              {setup.secret}
            </code>
          ) : null}
        </div>

        <input
          ref={inputRef}
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void confirm();
          }}
          placeholder="123456"
          aria-label="6-digit authenticator code"
          className="mt-4 w-full rounded-xl border border-ng-line bg-ng-paper px-4 py-3 text-center font-mono text-[20px] tracking-[0.3em] outline-none focus:border-ng-forest"
        />

        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="mt-3 w-full rounded-full bg-ng-forest-deep py-3 text-[14px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Confirm & enable"}
        </button>

        <div className="mt-3 flex items-center justify-center gap-5 text-[12.5px] font-medium">
          <button type="button" onClick={() => void snooze("later")} className="text-ng-ink-muted hover:text-ng-ink">
            Remind me later
          </button>
          <span className="text-ng-line">·</span>
          <button type="button" onClick={() => void snooze("skip")} className="text-ng-ink-muted hover:text-ng-ink">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
