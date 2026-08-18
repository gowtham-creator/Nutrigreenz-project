"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { otpProvider } from "@/lib/otp-provider";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ng/logo";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { OtpInput } from "@/components/ng/otp-input";
import { Icon } from "@/components/ui/icon";
import { AppIcon } from "@/components/ui/app-icon";
import { BrandIcon } from "@/components/ui/brand-icon";

type Method = "passcode" | "phone";

/** Best-effort E.164 for India-first numbers. Returns null when implausible. */
function toE164(raw: string): string | null {
  const t = raw.trim();
  if (t.startsWith("+")) {
    const d = t.replace(/[^\d]/g, "");
    return d.length >= 8 ? `+${d}` : null;
  }
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  return null;
}

/**
 * TactileField — wraps an input group so it gives a subtle spring lift + glow
 * on focus (liquid-glass tactility). The relatedTarget guard keeps the lift
 * steady while focus hops between OTP boxes. The scale transform is
 * automatically neutralised under `prefers-reduced-motion` by the surrounding
 * <MotionConfig reducedMotion="user">.
 */
function TactileField({ children }: { children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <motion.div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      animate={{ scale: focused ? 1.012 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      style={{ transformOrigin: "center" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * SpringPress — primary-action wrapper adding gentle press physics. The scale
 * is disabled under reduced motion via the ambient MotionConfig.
 */
function SpringPress({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 600, damping: 20 }}
      style={{ transformOrigin: "center" }}
      className={cn("w-full", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Constrain `?next=` to a same-origin path.
 *
 * The value was previously used raw, so a crafted link
 * (`/admin/login?next=https://example.com`) would send an operator off-site
 * immediately AFTER they authenticated — a post-auth open redirect, and a
 * convincing one because the sign-in genuinely succeeded first. Anything
 * absolute, scheme-relative ("//host") or backslash-escaped is discarded in
 * favour of the dashboard.
 */
function safeNextPath(raw: string | null): string {
  const fallback = "/admin";
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/**
 * Finish sign-in with a FULL document navigation.
 *
 * `router.push()` resolves against the client Router Cache, which still holds
 * the UNAUTHENTICATED render of the destination from the redirect that sent the
 * operator to this screen. The session cookie is set server-side, so the cached
 * payload never reflected it and the portal appeared not to open until a manual
 * refresh. A real navigation guarantees the server re-renders with the cookie.
 *
 * `replace` rather than `assign`, so the login screen — and the one-time code
 * still sitting in its inputs — is not left in history for a Back press.
 */
function completeSignIn(path: string): void {
  window.location.replace(path);
}

function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));

  // Phone-OTP delivery: Firebase (default) or MSG91 (flag). Stable per build.
  const msg91 = otpProvider() === "msg91";

  const [method, setMethod] = useState<Method>("passcode");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Passcode flow
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  // Super-admin second factor — pick any one of the enabled factors.
  const [mfaFactors, setMfaFactors] = useState<string[] | null>(null);
  const [mfaChoice, setMfaChoice] = useState<"totp" | "email" | "phone" | null>(null);
  const [totp, setTotp] = useState("");
  const [mail, setMail] = useState("");
  const [mailSending, setMailSending] = useState(false);
  // Saved operator number the mobile-OTP factor is delivered to (#42), echoed
  // by the passcode response so we can auto-send the Firebase OTP to it.
  const [otpPhone, setOtpPhone] = useState<string | null>(null);

  // Phone flow
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Tick the resend cooldown down to zero (1s steps).
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Idle sign-out (Feature #51) → explain why they landed back here.
  useEffect(() => {
    if (params.get("reason") === "timeout") {
      toast.message("Signed out due to inactivity", {
        description: "Please sign in again.",
      });
    }
  }, [params]);

  function switchMethod(m: Method) {
    setMethod(m);
    setError(null);
    resetMfa();
  }

  function resetMfa() {
    setMfaFactors(null);
    setMfaChoice(null);
    setTotp("");
    setMail("");
    // Tear down any in-flight mobile-OTP 2FA attempt too.
    setCode("");
    setCodeSent(false);
    setResendIn(0);
    confirmationRef.current = null;
    verifierRef.current?.clear();
    verifierRef.current = null;
  }

  async function sendMailCode() {
    setMailSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mfa/email-send", { method: "POST" });
      if (res.ok) {
        toast.success("Code sent", {
          description: "Check your admin email for the 6-digit code.",
        });
      } else {
        setError(
          res.status === 503
            ? "Email sign-in codes aren't set up yet."
            : "Couldn't send the email code.",
        );
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setMailSending(false);
    }
  }

  /**
   * Resolve the REAL number to send the mobile-OTP second factor to.
   *
   * `otpPhone` from the passcode step is only a masked hint (`••••••70`) so a
   * stolen passcode can't reveal the number on screen. Firebase phone auth is
   * client-side and needs the true E.164, so for that provider we fetch it from
   * the MFA-ticket-gated endpoint. MSG91 never needs it — the server sends the
   * SMS itself and the number stays server-side.
   */
  /**
   * The endpoint answers 401 `{ restart: true }` when the `ng_admin_mfa` ticket
   * has expired — the passcode step is no longer proven, so there is nothing to
   * send a code for. Collapsing that to `null` (as this used to) made an expired
   * ticket indistinguishable from a missing phone factor, and both surfaced as
   * "try another method" — advice that cannot work, because every factor is
   * gated by the same dead ticket. The signal is carried out so the caller can
   * send the operator back to the passcode instead.
   */
  async function resolveMfaPhone(): Promise<{ phone: string | null; restart: boolean }> {
    try {
      const res = await fetch("/api/admin/mfa/phone-target", { method: "POST" });
      if (!res.ok) return { phone: null, restart: res.status === 401 };
      const data = (await res.json()) as { phone?: string };
      return { phone: data.phone ?? null, restart: false };
    } catch {
      return { phone: null, restart: false };
    }
  }

  /** Bounce back to the passcode step after the 2FA window has lapsed. */
  function restartSignIn() {
    resetMfa();
    setError("That took too long. Enter your passcode again.");
  }

  // Auto-send the mobile-OTP 2FA code once the phone step (and its reCAPTCHA
  // container) has actually rendered — fixes the first send silently failing
  // while "Resend code" worked.
  useEffect(() => {
    if (mfaChoice !== "phone" || codeSent || submitting || resending) return;
    void (async () => {
      // MSG91 posts to its own ticket-gated send route and ignores the number.
      if (msg91) {
        await requestCode(false);
        return;
      }
      const { phone: real, restart } = await resolveMfaPhone();
      if (restart) {
        restartSignIn();
        return;
      }
      if (!real) {
        setError("Couldn't start mobile verification. Try another method.");
        return;
      }
      await requestCode(false, real);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfaChoice]);

  async function chooseFactor(f: "totp" | "email" | "phone" | null) {
    setMfaChoice(f);
    setError(null);
    if (f === "email") {
      await sendMailCode();
    } else if (f === "phone" && otpPhone) {
      // The OTP is sent from an effect AFTER this step (+ its reCAPTCHA container)
      // has mounted. Sending synchronously here raced the mount, so the first
      // attempt silently no-op'd and only "Resend code" worked.
      setCode("");
      setCodeSent(false);
    }
  }

  async function handlePasscode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, passcode }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          mfaRequired?: boolean;
          factors?: string[];
          otpPhone?: string | null;
        };
        if (data.mfaRequired) {
          const fs = (data.factors && data.factors.length ? data.factors : ["totp"]).filter(
            (f) => f === "totp" || f === "email" || f === "phone",
          );
          const list = fs.length ? fs : ["totp"];
          setError(null);
          setTotp("");
          setMail("");
          // Stash the saved mobile-OTP destination so chooseFactor("phone") can
          // auto-send the Firebase OTP to it.
          setOtpPhone(data.otpPhone ?? null);
          setMfaFactors(list);
          // One factor → go straight to it; several → show the chooser.
          await chooseFactor(
            list.length === 1 ? (list[0] as "totp" | "email" | "phone") : null,
          );
          return;
        }
        toast.success("Welcome back", { description: "Signed in to Admin." });
        completeSignIn(next);
        return;
      }
      const msg = "Invalid credentials.";
      setError(msg);
      toast.error("Sign in failed", { description: msg });
    } catch {
      const msg = "Could not reach the server. Try again.";
      setError(msg);
      toast.error("Sign in failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(totp)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login-2fa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "totp", code: totp }),
      });
      if (res.ok) {
        toast.success("Welcome back", { description: "Signed in to Admin." });
        completeSignIn(next);
        return;
      }
      // 401 with restart → the short-lived ticket expired; send them back.
      const data = (await res.json().catch(() => ({}))) as { restart?: boolean };
      if (data.restart) {
        resetMfa();
        const msg = "That took too long. Enter your passcode again.";
        setError(msg);
        toast.error("Session expired", { description: msg });
        return;
      }
      const msg = "Invalid or expired authenticator code.";
      setError(msg);
      toast.error("Verification failed", { description: msg });
    } catch {
      const msg = "Could not reach the server. Try again.";
      setError(msg);
      toast.error("Verification failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyMail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(mail)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login-2fa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "email", code: mail }),
      });
      if (res.ok) {
        toast.success("Welcome back", { description: "Signed in to Admin." });
        completeSignIn(next);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { restart?: boolean };
      if (data.restart) {
        resetMfa();
        const msg = "That took too long. Enter your passcode again.";
        setError(msg);
        toast.error("Session expired", { description: msg });
        return;
      }
      const msg = "Invalid or expired email code.";
      setError(msg);
      toast.error("Verification failed", { description: msg });
    } catch {
      const msg = "Could not reach the server. Try again.";
      setError(msg);
      toast.error("Verification failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyMfaPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (msg91) {
      // MSG91: the code was verified server-side against the admin's saved number.
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6-digit code.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/admin/login-2fa", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: "phone", code }),
        });
        if (res.ok) {
          toast.success("Welcome back", { description: "Signed in to Admin." });
          completeSignIn(next);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { restart?: boolean };
        if (data.restart) {
          resetMfa();
          const msg = "That took too long. Enter your passcode again.";
          setError(msg);
          toast.error("Session expired", { description: msg });
          return;
        }
        const msg = "We couldn't verify that code. Request a fresh one and try again.";
        setError(msg);
        toast.error("Verification failed", { description: msg });
      } catch {
        setError("Could not reach the server. Try again.");
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
      // Finish the SUPER-ADMIN second factor: login-2fa verifies the Firebase
      // phone token against the saved number and mints the real session.
      const res = await fetch("/api/admin/login-2fa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "phone", idToken }),
      });
      // Drop the throwaway Firebase phone session regardless of the outcome.
      if (auth) await signOut(auth).catch(() => {});
      if (res.ok) {
        toast.success("Welcome back", { description: "Signed in to Admin." });
        completeSignIn(next);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { restart?: boolean };
      if (data.restart) {
        resetMfa();
        const msg = "That took too long. Enter your passcode again.";
        setError(msg);
        toast.error("Session expired", { description: msg });
        return;
      }
      const msg = "We couldn't verify that code. Request a fresh one and try again.";
      setError(msg);
      toast.error("Verification failed", { description: msg });
    } catch (err) {
      // Reuse the same Firebase error-code handling as the Phone-OTP tab.
      const errCode = (err as { code?: string })?.code ?? "";
      console.error("[admin mobile 2FA] confirm failed:", errCode || err);
      const msg =
        errCode === "auth/invalid-verification-code"
          ? "That code is incorrect. Check it and re-enter."
          : errCode === "auth/code-expired" || errCode === "auth/session-expired"
            ? "Your code expired. Request a new one."
            : "Couldn't verify the code. Request a fresh one and try again.";
      setError(msg);
      toast.error("Verification failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function requestCode(isResend: boolean, overrideNumber?: string) {
    setError(null);
    if (msg91) {
      // MSG91: primary phone sign-in texts the ENTERED number via the generic
      // route; the 2FA factor (method="passcode") texts the admin's SERVER-STORED
      // number via a ticket-gated route — the client never supplies it.
      const isTwoFactor = method === "passcode";
      const e164 = isTwoFactor ? null : toE164(phone);
      if (!isTwoFactor && !e164) {
        setError("Enter your 10-digit mobile number.");
        return;
      }
      if (isResend) setResending(true);
      else setSubmitting(true);
      try {
        const res = isTwoFactor
          ? await fetch("/api/admin/mfa/phone-send", { method: "POST" })
          : await fetch("/api/auth/otp/send", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ phone: e164 }),
            });
        if (res.ok) {
          setCodeSent(true);
          setCode("");
          setResendIn(30);
          toast.success(isResend ? "New code sent" : "Code sent", {
            description: isTwoFactor
              ? `OTP sent to ${otpPhone ?? "your mobile"}.`
              : `OTP sent to ${e164}.`,
          });
        } else {
          const data = (await res.json().catch(() => ({}))) as {
            restart?: boolean;
            error?: string;
          };
          if (data.restart) {
            resetMfa();
            const msg = "That took too long. Enter your passcode again.";
            setError(msg);
            toast.error("Session expired", { description: msg });
          } else {
            const msg =
              res.status === 429
                ? "Too many attempts. Wait a few minutes and retry."
                : data.error === "SMS OTP not configured"
                  ? "SMS sign-in isn't configured yet."
                  : "Couldn't send the code.";
            setError(msg);
            toast.error("Sign in failed", { description: msg });
          }
        }
      } catch {
        setError("Could not reach the server. Try again.");
      } finally {
        if (isResend) setResending(false);
        else setSubmitting(false);
      }
      return;
    }
    if (!auth) {
      setError("Phone sign-in isn't configured yet. Add your Firebase keys.");
      return;
    }
    // The mobile-OTP 2FA flow (#42) passes the saved E.164 number directly so it
    // doesn't depend on the (async) `phone` state; the Phone-OTP tab uses input.
    const e164 = overrideNumber ? toE164(overrideNumber) : toE164(phone);
    if (!e164) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    const fbAuth = auth;
    if (isResend) setResending(true);
    else setSubmitting(true);
    try {
      verifierRef.current?.clear();
      const verifier = new RecaptchaVerifier(fbAuth, "admin-recaptcha", {
        size: "invisible",
      });
      verifierRef.current = verifier;
      // Initialise the invisible reCAPTCHA before the first send; without this the
      // very first signInWithPhoneNumber can no-op until the widget is warmed up.
      await verifier.render();
      confirmationRef.current = await signInWithPhoneNumber(fbAuth, e164, verifier);
      setCodeSent(true);
      setCode("");
      setResendIn(30);
      toast.success(isResend ? "New code sent" : "Code sent", {
        description: `OTP sent to ${e164}.`,
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      // Surface the real Firebase error in the console for debugging.
      console.error("[admin phone OTP] sendCode failed:", err);
      const friendly =
        code === "auth/operation-not-allowed"
          ? "Phone sign-in isn't enabled. Turn on Authentication → Sign-in method → Phone in Firebase."
          : code === "auth/invalid-app-credential" || code === "auth/captcha-check-failed"
            ? "reCAPTCHA check failed for this domain. Add localhost to Authorized domains."
            : code === "auth/invalid-phone-number"
              ? "That mobile number looks invalid."
              : code === "auth/too-many-requests"
                ? "Too many attempts. Wait a few minutes and retry."
                : `Couldn't send the code${code ? ` (${code})` : ""}.`;
      setError(friendly);
      toast.error("Sign in failed", { description: friendly });
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
      // MSG91 primary phone sign-in: post phone + code; server verifies + mints.
      const e164 = toE164(phone);
      if (!e164) {
        setError("Enter your 10-digit mobile number.");
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6-digit code.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/admin/login-phone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: e164, code }),
        });
        if (res.ok) {
          toast.success("Welcome back", { description: "Signed in to Admin." });
          completeSignIn(next);
          return;
        }
        const msg =
          res.status === 403
            ? "This number isn't an authorised operator."
            : res.status === 401
              ? "That code is incorrect or expired. Request a fresh one."
              : res.status >= 500
                ? "Server couldn't verify the sign-in. Please try again in a moment."
                : "We couldn't verify your sign-in. Request a fresh code and try again.";
        setError(msg);
        toast.error("Sign in failed", { description: msg });
      } catch {
        setError("Could not reach the server. Try again.");
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
      const res = await fetch("/api/admin/login-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) {
        toast.success("Welcome back", { description: "Signed in to Admin." });
        completeSignIn(next);
        return;
      }
      // Not an authorised operator (or expired) — drop the Firebase phone session
      // so a rejected number isn't left signed in on the client.
      if (auth) await signOut(auth).catch(() => {});
      const msg =
        res.status === 403
          ? "This number isn't an authorised operator."
          : res.status >= 500
            ? "Server couldn't verify the sign-in. Please try again in a moment."
            : "We couldn't verify your sign-in. Request a fresh code and try again.";
      setError(msg);
      toast.error("Sign in failed", { description: msg });
    } catch (err) {
      // confirm() rejected on the client — surface WHICH Firebase error so a real
      // expiry is distinguishable from a wrong/replayed code.
      const code = (err as { code?: string })?.code ?? "";
      console.error("[admin phone sign-in] confirm failed:", code || err);
      const msg =
        code === "auth/invalid-verification-code"
          ? "That code is incorrect. Check it and re-enter."
          : code === "auth/code-expired" || code === "auth/session-expired"
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

  // A stable key for the currently-visible pane; drives the spring crossfade +
  // auto-height animation when the operator moves between panes.
  const viewKey =
    method === "phone"
      ? codeSent
        ? "phone-verify"
        : "phone-send"
      : mfaFactors !== null
        ? mfaChoice === null
          ? "mfa-choose"
          : mfaChoice === "email"
            ? "mfa-email"
            : mfaChoice === "totp"
              ? "mfa-totp"
              : "mfa-phone"
        : "passcode";

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-ng-cream text-ng-ink flex flex-col lg:flex-row">
        {/* Brand panel — moving forest gradient + floating glows + rising
            particles (NXT-style motion, Nutri Greenz palette); the forest photo
            remains as a faint texture layer underneath. */}
        <aside className="login-gradient relative overflow-hidden lg:w-[44%] flex flex-col justify-between p-8 lg:p-12">
          <div
            aria-hidden
            className="login-photo absolute inset-0 opacity-[0.16] mix-blend-luminosity"
            style={{
              backgroundImage: "url(/images/admin/forest-panel.webp)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <span aria-hidden className="login-glow login-glow--a" />
          <span aria-hidden className="login-glow login-glow--b" />
          <span aria-hidden className="login-glow login-glow--c" />
          {[8, 22, 37, 51, 64, 78, 90, 15, 45, 70, 30, 58].map((left, i) => (
            <span
              key={left}
              aria-hidden
              className="login-particle"
              style={{ left: `${left}%`, "--pd": `${11 + (i % 5) * 2.6}s`, "--pdelay": `${(i * 1.7) % 12}s` } as React.CSSProperties}
            />
          ))}

          <Link
            href="/"
            className="relative z-10 flex w-fit items-center gap-2.5 rounded-full bg-ng-paper/75 px-3.5 py-2 backdrop-blur-md"
          >
            <Logo variant="mark" className="h-8" />
            <span className="font-display text-[17px] text-ng-forest-deep">Nutri Greenz</span>
          </Link>

          <div className="relative z-10 hidden max-w-sm rounded-3xl bg-ng-paper/75 p-7 shadow-[0_12px_36px_rgba(20,51,31,0.14)] backdrop-blur-md lg:block">
            <div className="inline-flex items-center gap-2 rounded-full bg-ng-forest/10 px-3 py-1.5 text-[11px] uppercase tracking-wider font-mono font-semibold text-ng-forest">
              <BrandIcon name="lock" weight="solid" size={14} />
              Admin · v0.4.1
            </div>
            <h2 className="font-display text-[34px] leading-tight text-ng-forest-deep mt-5">
              Operator console
            </h2>
            <p className="font-sans text-[14px] font-medium text-ng-ink-muted mt-3 leading-relaxed">
              Manage catalog, orders, inventory and marketing for the Nutri Greenz
              storefront. Restricted to authorised operators.
            </p>
          </div>

          <p className="relative z-10 w-fit rounded-full bg-ng-paper/75 px-3.5 py-1.5 font-mono text-[11.5px] font-medium text-ng-forest backdrop-blur-md">
            Secured area — activity may be monitored.
          </p>
        </aside>

        {/* Form panel — the deep forest moving gradient continues across the
            whole screen; the form floats on a frosted liquid-glass card. */}
        <main className="login-gradient relative flex-1 flex items-center justify-center overflow-hidden p-8 lg:p-12">
          <span aria-hidden className="login-glow login-glow--a login-glow--soft" />
          <span aria-hidden className="login-glow login-glow--b login-glow--soft" />
          <span aria-hidden className="login-glow login-glow--c" />
          {[12, 34, 55, 74, 88, 24, 63].map((left, i) => (
            <span
              key={left}
              aria-hidden
              className="login-particle"
              style={{ left: `${left}%`, "--pd": `${12 + (i % 4) * 2.4}s`, "--pdelay": `${(i * 2.1) % 11}s` } as React.CSSProperties}
            />
          ))}
          <div className="login-card relative z-10 w-full max-w-sm rounded-3xl p-7 sm:p-8">
            <div className="size-12 rounded-full bg-ng-forest-deep text-ng-leaf flex items-center justify-center mb-6">
              <BrandIcon name="lock" weight="solid" size={24} />
            </div>

            <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
              Sign in to Admin
            </h1>
            <p className="font-sans text-[13.5px] font-medium text-ng-ink-muted mt-2">
              Enter your operator credentials to continue.
            </p>

            {/* Method toggle: Passcode | Phone OTP — the active pill is a shared
                layout element, so it springs between segments on switch. */}
            <div className="relative mt-6 grid grid-cols-2 gap-1 rounded-xl bg-ng-paper border border-ng-line p-1">
              {(["passcode", "phone"] as const).map((m) => {
                const active = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMethod(m)}
                    aria-pressed={active}
                    className={
                      "relative flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-colors " +
                      (active ? "text-ng-cream" : "text-ng-ink-muted hover:text-ng-ink")
                    }
                  >
                    {active ? (
                      <motion.span
                        layoutId="admin-auth-pill"
                        aria-hidden
                        className="absolute inset-0 rounded-lg bg-ng-forest-deep shadow-[0_6px_16px_rgba(10,31,18,0.28)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
                      />
                    ) : null}
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      <Icon
                        name={m === "passcode" ? "key-minimalistic-bold" : "phone-bold"}
                        size={15}
                      />
                      {m === "passcode" ? "Passcode" : "Phone OTP"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Content region — spring auto-height + crossfade between panes. */}
            <motion.div
              layout
              className="relative mt-6"
              transition={{ layout: { type: "spring", stiffness: 260, damping: 30 } }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={viewKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.26, ease: [0.25, 0.6, 0.2, 1] }}
                >
                  {method === "passcode" && mfaFactors !== null && mfaChoice === null ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-[13px] font-medium text-ng-ink-muted">
                        Choose how to finish signing in:
                      </p>
                      {mfaFactors.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => void chooseFactor(f as "totp" | "email" | "phone")}
                          className="flex items-center gap-3 rounded-xl border border-ng-line bg-ng-paper px-4 py-3 text-left text-[13.5px] font-semibold text-ng-ink transition-colors hover:border-ng-leaf cursor-pointer"
                        >
                          <Icon
                            name={
                              f === "email"
                                ? "letter-bold"
                                : f === "phone"
                                  ? "phone-bold"
                                  : "shield-keyhole-bold"
                            }
                            size={18}
                            className="text-ng-forest"
                          />
                          {f === "email"
                            ? "Email one-time code"
                            : f === "phone"
                              ? "Mobile code"
                              : "Authenticator app"}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={resetMfa}
                        className="self-start text-[12px] font-semibold text-ng-forest transition-colors hover:text-ng-leaf cursor-pointer"
                      >
                        Back to sign in
                      </button>
                    </div>
                  ) : method === "passcode" && mfaChoice === "email" ? (
                    <form onSubmit={verifyMail} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-semibold text-ng-ink">Email code</span>
                        <p className="-mt-1 text-[12.5px] text-ng-ink-muted">
                          Enter the 6-digit code we emailed you.
                        </p>
                        <TactileField>
                          <OtpInput value={mail} onChange={setMail} />
                        </TactileField>
                        {error ? (
                          <p className="text-[12px] font-medium text-ng-danger">{error}</p>
                        ) : null}
                      </div>
                      <SpringPress className="mt-1">
                        <Button type="submit" fullWidth disabled={submitting}>
                          <AppIcon name="email" size={18} />
                          {submitting ? "Verifying…" : "Verify & sign in"}
                        </Button>
                      </SpringPress>
                      <div className="flex items-center justify-between text-[12px] font-sans font-semibold">
                        <button
                          type="button"
                          disabled={mailSending}
                          onClick={() => void sendMailCode()}
                          className="text-ng-forest transition-colors hover:text-ng-leaf disabled:text-ng-ink-soft cursor-pointer"
                        >
                          {mailSending ? "Sending…" : "Resend code"}
                        </button>
                        <button
                          type="button"
                          onClick={() => (mfaFactors && mfaFactors.length > 1 ? chooseFactor(null) : resetMfa())}
                          className="text-ng-ink-muted transition-colors hover:text-ng-ink cursor-pointer"
                        >
                          {mfaFactors && mfaFactors.length > 1 ? "Use another method" : "Back to sign in"}
                        </button>
                      </div>
                    </form>
                  ) : method === "passcode" && mfaChoice === "totp" ? (
                    <form onSubmit={verifyMfa} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-semibold text-ng-ink">
                          Authenticator code
                        </span>
                        <p className="-mt-1 text-[12.5px] text-ng-ink-muted">
                          Open your authenticator app and enter the current 6-digit code
                          for Nutri Greenz Admin.
                        </p>
                        <TactileField>
                          <OtpInput value={totp} onChange={setTotp} />
                        </TactileField>
                        {error ? (
                          <p className="text-[12px] font-medium text-ng-danger">{error}</p>
                        ) : null}
                      </div>
                      <SpringPress className="mt-1">
                        <Button type="submit" fullWidth disabled={submitting}>
                          <BrandIcon name="lock" weight="solid" size={18} />
                          {submitting ? "Verifying…" : "Verify & sign in"}
                        </Button>
                      </SpringPress>
                      <button
                        type="button"
                        onClick={() => (mfaFactors && mfaFactors.length > 1 ? chooseFactor(null) : resetMfa())}
                        className="text-[12px] font-sans font-semibold text-ng-forest transition-colors hover:text-ng-leaf cursor-pointer"
                      >
                        {mfaFactors && mfaFactors.length > 1 ? "Use another method" : "Back to sign in"}
                      </button>
                    </form>
                  ) : method === "passcode" && mfaChoice === "phone" ? (
                    <form onSubmit={verifyMfaPhone} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-semibold text-ng-ink">Mobile code</span>
                        <p className="-mt-1 text-[12.5px] text-ng-ink-muted">
                          {codeSent
                            ? `Enter the 6-digit code we sent to ${otpPhone ?? "your mobile"}.`
                            : `Sending a code to ${otpPhone ?? "your mobile"}…`}
                        </p>
                        <TactileField>
                          <OtpInput value={code} onChange={setCode} />
                        </TactileField>
                        {error ? (
                          <p className="text-[12px] font-medium text-ng-danger">{error}</p>
                        ) : null}
                      </div>
                      <SpringPress className="mt-1">
                        <Button type="submit" fullWidth disabled={submitting || !codeSent}>
                          <Icon name="phone-bold" size={18} />
                          {submitting ? "Verifying…" : "Verify & sign in"}
                        </Button>
                      </SpringPress>
                      <div className="flex items-center justify-between text-[12px] font-sans font-semibold">
                        <button
                          type="button"
                          disabled={resendIn > 0 || resending || submitting}
                          onClick={() =>
                            void (async () => {
                              // Same masked-hint problem as the initial send:
                              // resolve the real number for Firebase; MSG91
                              // sends server-side and needs no number.
                              if (msg91) return requestCode(true);
                              const { phone: real, restart } = await resolveMfaPhone();
                              if (real) return requestCode(true, real);
                              if (restart) return restartSignIn();
                              setError("Couldn't resend. Try another method.");
                            })()
                          }
                          className="text-ng-forest transition-colors hover:text-ng-leaf disabled:cursor-not-allowed disabled:text-ng-ink-soft disabled:hover:text-ng-ink-soft cursor-pointer"
                        >
                          {resending
                            ? "Sending…"
                            : resendIn > 0
                              ? `Resend code in 0:${String(resendIn).padStart(2, "0")}`
                              : "Resend code"}
                        </button>
                        <button
                          type="button"
                          onClick={() => (mfaFactors && mfaFactors.length > 1 ? chooseFactor(null) : resetMfa())}
                          className="text-ng-ink-muted transition-colors hover:text-ng-ink cursor-pointer"
                        >
                          {mfaFactors && mfaFactors.length > 1 ? "Use another method" : "Back to sign in"}
                        </button>
                      </div>
                    </form>
                  ) : method === "passcode" && mfaFactors === null ? (
                    <form onSubmit={handlePasscode} className="flex flex-col gap-4">
                      <TactileField>
                        <Input
                          label="Email"
                          type="email"
                          autoComplete="username"
                          placeholder="you@nutrigreenz.farm"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          prefix={<AppIcon name="email" size={18} />}
                          error={error ?? undefined}
                        />
                      </TactileField>
                      <TactileField>
                        <Input
                          label="Passcode"
                          type={showPasscode ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value)}
                          prefix={<Icon name="lock-keyhole-minimalistic-bold" size={18} />}
                          suffix={
                            <button
                              type="button"
                              onClick={() => setShowPasscode((s) => !s)}
                              aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
                              className="inline-flex items-center justify-center text-ng-ink-soft hover:text-ng-forest transition-colors"
                            >
                              <Icon name={showPasscode ? "eye-closed-bold" : "eye-bold"} size={18} />
                            </button>
                          }
                          error={error ?? undefined}
                        />
                      </TactileField>

                      <div className="-mt-1 text-right">
                        <Link
                          href="/admin/forgot"
                          className="text-[12px] font-sans font-semibold text-ng-ink hover:text-ng-forest-deep transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>

                      <SpringPress className="mt-1">
                        <Button type="submit" fullWidth disabled={submitting}>
                          <BrandIcon name="lock" weight="solid" size={18} />
                          {submitting ? "Signing in…" : "Sign in to Admin"}
                        </Button>
                      </SpringPress>
                    </form>
                  ) : !codeSent ? (
                    <form onSubmit={sendCode} className="flex flex-col gap-4">
                      <TactileField>
                        <Input
                          label="Mobile number"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="98XXX XXXXX"
                          value={phone}
                          onChange={(e) => {
                            // The field already shows a +91 prefix, so it holds
                            // the 10 national digits. Be forgiving about what is
                            // typed or pasted: strip spaces/dashes/brackets, and
                            // drop a leading +91 / 91 / 0 so pasting the full
                            // international number works instead of being
                            // silently truncated into an invalid one.
                            let d = e.target.value.replace(/\D/g, "");
                            if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
                            if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
                            setPhone(d.slice(0, 10));
                          }}
                          prefix={
                            <span className="text-[15px] font-medium text-ng-ink">+91</span>
                          }
                          hint="Authorised operator numbers only."
                          error={error ?? undefined}
                        />
                      </TactileField>
                      <SpringPress className="mt-1">
                        <Button type="submit" fullWidth disabled={submitting}>
                          <AppIcon name="message" size={18} />
                          {submitting ? "Sending…" : "Send OTP"}
                        </Button>
                      </SpringPress>
                    </form>
                  ) : (
                    <form onSubmit={verifyCode} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-semibold text-ng-ink">
                          Enter the 6-digit code
                        </span>
                        <TactileField>
                          <OtpInput value={code} onChange={setCode} />
                        </TactileField>
                        {error ? (
                          <p className="text-[12px] font-medium text-ng-danger">{error}</p>
                        ) : null}
                      </div>
                      <SpringPress className="mt-1">
                        <Button type="submit" fullWidth disabled={submitting}>
                          <BrandIcon name="lock" weight="solid" size={18} />
                          {submitting ? "Verifying…" : "Verify & sign in"}
                        </Button>
                      </SpringPress>
                      <div className="flex items-center justify-between text-[12px] font-sans font-semibold">
                        <button
                          type="button"
                          disabled={resendIn > 0 || resending || submitting}
                          onClick={() => void requestCode(true)}
                          className="text-ng-forest transition-colors hover:text-ng-leaf disabled:cursor-not-allowed disabled:text-ng-ink-soft disabled:hover:text-ng-ink-soft"
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
                          className="text-ng-ink-muted transition-colors hover:text-ng-ink"
                        >
                          Use a different number
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Invisible reCAPTCHA target for phone OTP (abuse protection). */}
            <div id="admin-recaptcha" />

            <div className="mt-6 flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted font-mono">
              <BrandIcon name="lock" weight="solid" size={13} />
              Authorised operators only
            </div>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ng-cream" aria-hidden />}>
      <LoginForm />
    </Suspense>
  );
}
