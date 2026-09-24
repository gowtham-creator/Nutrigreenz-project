"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { otpProvider, OTP_RESEND_SECONDS } from "@/lib/otp-provider";
import { clearCaptainCache } from "@/components/ng/captain/captain-store";
import { Logo } from "@/components/ng/logo";
import { OtpInput } from "@/components/ng/otp-input";
import { UiIcon } from "@/components/ui/ui-icon";
import { AppIcon } from "@/components/ui/app-icon";

const NOT_CONFIGURED =
  "Phone sign-in isn't configured yet. Add your Firebase keys to .env.local.";

/** Best-effort E.164 for an India-first mobile. Returns null when implausible. */
function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  return null;
}

/** Only ever return the captain to an internal /captain path (no open redirect). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/captain") ? raw : "/captain";
}

const leafCta =
  "w-full flex items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold py-3.5 text-[14.5px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-45 disabled:hover:bg-ng-leaf active:scale-[0.98] shadow-[0_10px_24px_-8px_rgba(102,191,115,0.7)]";

function CaptainLoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  // Phone-OTP delivery: Firebase (default) or MSG91 (flag). Stable per build.
  const msg91 = otpProvider() === "msg91";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Tick the resend cooldown down to zero (1s steps).
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestCode(isResend: boolean) {
    setError(null);
    if (msg91) {
      // MSG91: no Firebase SDK / no reCAPTCHA — the server texts the code.
      const e164 = toE164(phone);
      if (!e164) {
        setError("Enter a valid 10-digit mobile number.");
        return;
      }
      if (isResend) setResending(true);
      else setSubmitting(true);
      try {
        const res = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: e164 }),
        });
        if (res.ok) {
          setCodeSent(true);
          setCode("");
          setResendIn(OTP_RESEND_SECONDS);
          toast.success(isResend ? "New code sent" : "Code sent", {
            description: `OTP sent to ${e164}.`,
          });
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg =
            res.status === 429
              ? "Too many attempts. Wait a few minutes and retry."
              : data.error === "SMS OTP not configured"
                ? "SMS sign-in isn't configured yet."
                : "Couldn't send the code.";
          setError(msg);
          toast.error("Couldn't send code", { description: msg });
        }
      } catch {
        setError("Couldn't reach the server. Try again.");
      } finally {
        if (isResend) setResending(false);
        else setSubmitting(false);
      }
      return;
    }
    if (!auth) {
      setError(NOT_CONFIGURED);
      return;
    }
    const e164 = toE164(phone);
    if (!e164) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    const fbAuth = auth;
    if (isResend) setResending(true);
    else setSubmitting(true);
    try {
      // reCAPTCHA tokens are single-use — drop any prior verifier so a resend can't
      // hit "already rendered", then warm the invisible widget before the send.
      verifierRef.current?.clear();
      const verifier = new RecaptchaVerifier(fbAuth, "captain-recaptcha", { size: "invisible" });
      verifierRef.current = verifier;
      await verifier.render();
      confirmationRef.current = await signInWithPhoneNumber(fbAuth, e164, verifier);
      setCodeSent(true);
      setCode("");
      setResendIn(OTP_RESEND_SECONDS);
      toast.success(isResend ? "New code sent" : "Code sent", { description: `OTP sent to ${e164}.` });
    } catch (err) {
      const c =
        err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      console.error("[captain phone OTP] sendCode failed:", err);
      const friendly =
        c === "auth/operation-not-allowed"
          ? "Phone sign-in isn't enabled. Turn on Authentication → Sign-in method → Phone in Firebase."
          : c === "auth/invalid-app-credential" || c === "auth/captcha-check-failed"
            ? "reCAPTCHA check failed for this domain. Add it to Firebase Authorized domains."
            : c === "auth/invalid-phone-number"
              ? "That mobile number looks invalid."
              : c === "auth/too-many-requests"
                ? "Too many attempts. Wait a few minutes and retry."
                : `Couldn't send the code${c ? ` (${c})` : ""}.`;
      setError(friendly);
      toast.error("Couldn't send code", { description: friendly });
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      if (isResend) setResending(false);
      else setSubmitting(false);
    }
  }

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    void requestCode(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (msg91) {
      // MSG91: post the phone + code; the server verifies it and mints ng_captain.
      const e164 = toE164(phone);
      if (!e164) {
        setError("Enter a valid 10-digit mobile number.");
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6-digit code.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/captain/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: e164, code }),
        });
        if (res.ok) {
          clearCaptainCache();
          toast.success("Signed in", { description: "Welcome back, Captain." });
          window.location.assign(next);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        const msg =
          res.status === 403
            ? (data.message ?? "This number isn't registered as an active captain.")
            : res.status === 401
              ? "That code is incorrect or expired. Request a fresh one."
              : res.status === 503
                ? "Sign-in isn't available right now. Please try again shortly."
                : "We couldn't verify your sign-in. Request a fresh code and try again.";
        setError(msg);
        toast.error("Sign in failed", { description: msg });
      } catch {
        setError("Couldn't reach the server. Try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError("Request a code first.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    try {
      const cred = await confirmation.confirm(code);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/captain/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        // Fresh session → clear any prior captain's local cache before entering.
        clearCaptainCache();
        toast.success("Signed in", { description: "Welcome back, Captain." });
        // Hard-navigate so the /captain layout remounts and hydrates /me cleanly.
        window.location.assign(next);
        return;
      }
      // Rejected — drop the throwaway Firebase phone session so a non-captain
      // number isn't left signed in on the client.
      if (auth) await signOut(auth).catch(() => {});
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      const msg =
        res.status === 403
          ? (data.message ?? "This number isn't registered as an active captain.")
          : res.status === 503
            ? "Sign-in isn't available right now. Please try again shortly."
            : "We couldn't verify your sign-in. Request a fresh code and try again.";
      setError(msg);
      toast.error("Sign in failed", { description: msg });
    } catch (err) {
      const c = (err as { code?: string })?.code ?? "";
      console.error("[captain phone sign-in] confirm failed:", c || err);
      const msg =
        c === "auth/invalid-verification-code"
          ? "That code is incorrect. Check it and re-enter."
          : c === "auth/code-expired" || c === "auth/session-expired"
            ? "Your code expired. Request a new one."
            : "Couldn't verify the code. Request a fresh one and try again.";
      setError(msg);
      toast.error("Sign in failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function resetPhone() {
    setCodeSent(false);
    setCode("");
    setResendIn(0);
    confirmationRef.current = null;
    verifierRef.current?.clear();
    verifierRef.current = null;
    setError(null);
  }

  return (
    <div className="min-h-screen bg-ng-forest-deep text-ng-cream flex justify-center">
      {/* Phone-shaped container — matches the authenticated captain shell */}
      <div className="w-full max-w-[460px] min-h-screen bg-ng-paper text-ng-ink relative flex flex-col sm:my-6 sm:min-h-[calc(100vh-3rem)] sm:rounded-[36px] sm:overflow-hidden sm:ring-1 sm:ring-ng-forest-deep/15 sm:shadow-[0_40px_90px_-20px_rgba(10,31,18,0.55)]">
        {/* ===== Lush forest header ===== */}
        <header className="relative overflow-hidden bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-forest-deep text-ng-cream">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(115% 80% at 85% -12%, rgba(102,191,115,0.30), transparent 58%), radial-gradient(100% 70% at 0% 6%, rgba(76,175,80,0.16), transparent 55%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-ng-leaf/45 to-transparent"
            aria-hidden
          />
          <div className="relative px-5 pt-[max(1.4rem,env(safe-area-inset-top))] pb-6">
            <div className="flex items-center gap-2.5">
              <Logo variant="full" tone="white" className="!h-[26px]" priority />
              <span className="inline-flex items-center gap-1 rounded-md bg-ng-leaf/15 ring-1 ring-ng-leaf/35 px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.18em] text-ng-leaf">
                <UiIcon name="captain" size={11} className="text-ng-leaf" />
                Captain
              </span>
            </div>
            <h1 className="font-display text-[26px] text-ng-cream leading-tight mt-5">Field-tool sign-in</h1>
            <p className="text-[13px] text-ng-cream/70 mt-2 leading-snug">
              Verify your registered captain mobile to open today&apos;s stall.
            </p>
          </div>
        </header>

        {/* ===== Body ===== */}
        <main className="flex-1 px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {!msg91 && !isFirebaseConfigured ? (
            <div className="flex gap-2.5 rounded-2xl bg-ng-amber/15 border border-ng-amber/30 px-3.5 py-3 mb-5">
              <UiIcon name="caution" size={18} className="text-ng-soil shrink-0" />
              <p className="text-[12.5px] leading-snug text-ng-ink-muted">{NOT_CONFIGURED}</p>
            </div>
          ) : null}

          {!codeSent ? (
            <form onSubmit={sendCode} className="space-y-4">
              <label className="block">
                <span className="text-[12.5px] font-medium text-ng-ink-muted">Captain mobile</span>
                <div className="mt-1.5 flex items-center gap-2 w-full rounded-xl bg-ng-white border border-ng-line px-3.5 py-3 focus-within:border-ng-forest focus-within:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all">
                  <span className="text-[14px] text-ng-ink-soft font-mono pl-0.5">+91</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98XXXXXXXX"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className="flex-1 bg-transparent outline-none text-[15px] tracking-wide text-ng-ink placeholder:text-ng-ink-soft"
                  />
                  {/^[6-9]\d{9}$/.test(phone) ? (
                    <UiIcon name="verified" size={18} className="text-ng-success" />
                  ) : null}
                </div>
                <span className="block text-[11px] text-ng-ink-soft mt-1">Registered captain numbers only.</span>
              </label>
              {error ? <p className="text-[11.5px] text-ng-danger">{error}</p> : null}
              <button type="submit" disabled={submitting || (!msg91 && !isFirebaseConfigured)} className={leafCta}>
                <AppIcon name="message" size={18} />
                {submitting ? "Sending…" : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div>
                <span className="text-[12.5px] font-medium text-ng-ink-muted">Enter the 6-digit code</span>
                <p className="text-[11.5px] text-ng-ink-soft mt-1 mb-2.5">
                  Sent to <span className="font-mono">+91 {phone}</span>.
                </p>
                <OtpInput value={code} onChange={setCode} />
              </div>
              {error ? <p className="text-[11.5px] text-ng-danger">{error}</p> : null}
              <button type="submit" disabled={submitting} className={leafCta}>
                <UiIcon name="lock" size={18} />
                {submitting ? "Verifying…" : "Verify & open stall"}
              </button>
              <div className="flex items-center justify-between text-[12px] font-semibold">
                <button
                  type="button"
                  disabled={resendIn > 0 || resending || submitting}
                  onClick={() => void requestCode(true)}
                  className="text-ng-forest hover:text-ng-forest-deep disabled:text-ng-ink-soft disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {resending
                    ? "Sending…"
                    : resendIn > 0
                      ? `Resend code in 0:${String(resendIn).padStart(2, "0")}`
                      : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={resetPhone}
                  className="text-ng-ink-muted hover:text-ng-ink cursor-pointer transition-colors"
                >
                  Use a different number
                </button>
              </div>
            </form>
          )}

          {/* Invisible reCAPTCHA target for phone OTP (abuse protection). */}
          <div id="captain-recaptcha" />

          <div className="mt-8 flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted">
            <UiIcon name="lock" size={13} />
            Authorised captains only
          </div>
        </main>
      </div>
    </div>
  );
}

export default function CaptainLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ng-forest-deep" aria-hidden />}>
      <CaptainLoginForm />
    </Suspense>
  );
}
