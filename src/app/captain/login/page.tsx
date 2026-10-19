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
  "Phone sign-in is not set up on this server yet. Ask the office to add the Firebase keys.";

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
  "w-full flex min-h-12 items-center justify-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-bold text-[16px] cursor-pointer hover:bg-ng-green-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2";

/** The captain id from a successful login response, so a returning captain
 *  keeps the sales still waiting on this phone. */
async function signedInCaptainId(res: Response): Promise<string | undefined> {
  const data = (await res.json().catch(() => ({}))) as { captain?: { id?: string } };
  return data.captain?.id;
}

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
            description: `We sent a 6-digit code to ${e164}.`,
          });
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg =
            res.status === 429
              ? "Too many attempts. Wait a few minutes, then try again."
              : data.error === "SMS OTP not configured"
                ? "SMS sign-in is not set up yet. Ask the office."
                : "The code was not sent. Try again in a moment.";
          setError(msg);
          toast.error("Code not sent", { description: msg });
        }
      } catch {
        setError("No connection to the server. Check your internet and try again.");
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
      toast.success(isResend ? "New code sent" : "Code sent", { description: `We sent a 6-digit code to ${e164}.` });
    } catch (err) {
      const c =
        err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      console.error("[captain phone OTP] sendCode failed:", err);
      const friendly =
        c === "auth/operation-not-allowed"
          ? "Phone sign-in is turned off in Firebase. Ask the office to turn it on."
          : c === "auth/invalid-app-credential" || c === "auth/captcha-check-failed"
            ? "The security check failed for this website. Ask the office to add it in Firebase."
            : c === "auth/invalid-phone-number"
              ? "That mobile number is not valid. Check it and try again."
              : c === "auth/too-many-requests"
                ? "Too many attempts. Wait a few minutes, then try again."
                : `The code was not sent${c ? ` (${c})` : ""}. Try again in a moment.`;
      setError(friendly);
      toast.error("Code not sent", { description: friendly });
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
          clearCaptainCache(await signedInCaptainId(res));
          toast.success("Signed in");
          window.location.assign(next);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        const msg =
          res.status === 403
            ? (data.message ?? "This number is not registered as an active captain. Ask the office to add it.")
            : res.status === 401
              ? "That code is wrong or has expired. Ask for a new code."
              : res.status === 503
                ? "Sign-in is not available right now. Try again in a few minutes."
                : "Sign-in did not work. Ask for a new code and try again.";
        setError(msg);
        toast.error("Not signed in", { description: msg });
      } catch {
        setError("No connection to the server. Check your internet and try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError("Ask for a code first.");
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
        // Fresh session → clear any prior captain's local cache before entering
        // (kept when the same captain signs back in, so queued sales survive).
        clearCaptainCache(await signedInCaptainId(res));
        toast.success("Signed in");
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
          ? (data.message ?? "This number is not registered as an active captain. Ask the office to add it.")
          : res.status === 503
            ? "Sign-in is not available right now. Try again in a few minutes."
            : "Sign-in did not work. Ask for a new code and try again.";
      setError(msg);
      toast.error("Not signed in", { description: msg });
    } catch (err) {
      const c = (err as { code?: string })?.code ?? "";
      console.error("[captain phone sign-in] confirm failed:", c || err);
      const msg =
        c === "auth/invalid-verification-code"
          ? "That code is wrong. Check it and enter it again."
          : c === "auth/code-expired" || c === "auth/session-expired"
            ? "Your code has expired. Ask for a new one."
            : "The code could not be checked. Ask for a new one and try again.";
      setError(msg);
      toast.error("Not signed in", { description: msg });
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
    <div className="min-h-dvh bg-ng-forest-deep text-ng-cream flex justify-center">
      {/* Phone-shaped container — matches the authenticated captain shell */}
      <div className="w-full max-w-[460px] min-h-dvh bg-ng-paper text-ng-ink relative flex flex-col sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[36px] sm:overflow-hidden sm:ring-1 sm:ring-ng-forest-deep/15 sm:shadow-xl">
        <header className="bg-ng-forest-deep text-ng-cream">
          <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6">
            <Logo variant="full" tone="white" className="!h-[26px]" priority />
            <h1 className="font-display text-[30px] text-ng-cream leading-tight mt-6 text-balance">Captain sign-in</h1>
            <p className="text-[15px] text-ng-cream/80 mt-2 leading-snug text-pretty">
              Sign in with the mobile number the office registered for you. We will text you a code.
            </p>
          </div>
        </header>

        <main className="flex-1 px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {!msg91 && !isFirebaseConfigured ? (
            <div role="alert" className="flex gap-2.5 rounded-2xl bg-ng-amber/15 border border-ng-amber/30 px-3.5 py-3 mb-5">
              <UiIcon name="caution" size={18} className="text-ng-soil shrink-0" />
              <p className="text-[14px] leading-snug text-ng-ink">{NOT_CONFIGURED}</p>
            </div>
          ) : null}

          {!codeSent ? (
            <form onSubmit={sendCode} className="space-y-4" noValidate>
              <div>
                <label htmlFor="captain-phone" className="block text-[14px] font-medium text-ng-ink">
                  Mobile number
                </label>
                <div className="mt-1.5 flex min-h-12 items-center gap-2 w-full rounded-xl bg-ng-white border border-ng-line px-3.5 focus-within:border-ng-forest focus-within:ring-2 focus-within:ring-ng-leaf/50">
                  <span className="text-[16px] text-ng-ink-muted tabular-nums" aria-hidden>
                    +91
                  </span>
                  <input
                    id="captain-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98XXXXXXXX"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    aria-describedby={error ? "captain-login-error" : "captain-phone-hint"}
                    aria-invalid={Boolean(error)}
                    className="min-w-0 flex-1 bg-transparent outline-none text-[17px] tabular-nums text-ng-ink placeholder:text-ng-ink-soft"
                  />
                  {/^[6-9]\d{9}$/.test(phone) ? (
                    <UiIcon name="verified" size={20} className="text-ng-success" />
                  ) : null}
                </div>
                <p id="captain-phone-hint" className="text-[13px] text-ng-ink-muted mt-1">
                  10 digits, without +91.
                </p>
              </div>
              {error ? (
                <p id="captain-login-error" role="alert" className="text-[14px] font-medium text-ng-danger text-pretty">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={submitting || (!msg91 && !isFirebaseConfigured)} className={leafCta}>
                <AppIcon name="message" size={18} />
                {submitting ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4" noValidate>
              <div>
                <span id="captain-code-label" className="block text-[14px] font-medium text-ng-ink">
                  Enter the 6-digit code
                </span>
                <p className="text-[14px] text-ng-ink-muted mt-1 mb-3">
                  Sent to <span className="tabular-nums">+91 {phone}</span>
                </p>
                <OtpInput value={code} onChange={setCode} />
              </div>
              {error ? (
                <p role="alert" className="text-[14px] font-medium text-ng-danger text-pretty">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={submitting} className={leafCta}>
                <UiIcon name="lock" size={18} />
                {submitting ? "Checking…" : "Sign in"}
              </button>
              <div className="flex items-center justify-between gap-2 text-[14px] font-semibold">
                <button
                  type="button"
                  disabled={resendIn > 0 || resending || submitting}
                  onClick={() => void requestCode(true)}
                  className="min-h-11 px-1 text-ng-forest hover:text-ng-forest-deep disabled:text-ng-ink-soft disabled:cursor-not-allowed cursor-pointer transition-colors tabular-nums"
                >
                  {resending ? "Sending…" : resendIn > 0 ? `Send again in ${resendIn}s` : "Send a new code"}
                </button>
                <button
                  type="button"
                  onClick={resetPhone}
                  className="min-h-11 px-1 text-ng-ink-muted hover:text-ng-ink cursor-pointer transition-colors"
                >
                  Change number
                </button>
              </div>
            </form>
          )}

          {/* Invisible reCAPTCHA target for phone OTP (abuse protection). */}
          <div id="captain-recaptcha" />

          <p className="mt-8 flex items-center gap-1.5 text-[13px] text-ng-ink-muted">
            <UiIcon name="lock" size={14} />
            For NutriGreenz captains only.
          </p>
        </main>
      </div>
    </div>
  );
}

export default function CaptainLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ng-forest-deep" aria-hidden />}>
      <CaptainLoginForm />
    </Suspense>
  );
}
