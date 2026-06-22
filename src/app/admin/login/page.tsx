"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Logo } from "@/components/ng/logo";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { OtpInput } from "@/components/ng/otp-input";
import { Icon } from "@/components/ui/icon";

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

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [method, setMethod] = useState<Method>("passcode");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Passcode flow
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");

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

  function switchMethod(m: Method) {
    setMethod(m);
    setError(null);
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
        toast.success("Welcome back", { description: "Signed in to Admin." });
        router.push(next);
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

  async function requestCode(isResend: boolean) {
    setError(null);
    if (!auth) {
      setError("Phone sign-in isn't configured yet — add your Firebase keys.");
      return;
    }
    const e164 = toE164(phone);
    if (!e164) {
      setError("Enter a valid mobile number with country code.");
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
          ? "Phone sign-in isn't enabled — turn on Authentication → Sign-in method → Phone in Firebase."
          : code === "auth/invalid-app-credential" || code === "auth/captcha-check-failed"
            ? "reCAPTCHA check failed for this domain — add localhost to Authorized domains."
            : code === "auth/invalid-phone-number"
              ? "That mobile number looks invalid."
              : code === "auth/too-many-requests"
                ? "Too many attempts — wait a few minutes and retry."
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
        router.push(next);
        return;
      }
      // Not an authorised operator (or expired) — drop the Firebase phone session
      // so a rejected number isn't left signed in on the client.
      if (auth) await signOut(auth).catch(() => {});
      const msg =
        res.status === 403
          ? "This number isn't an authorised operator."
          : "Invalid or expired code.";
      setError(msg);
      toast.error("Sign in failed", { description: msg });
    } catch {
      setError("Invalid or expired code.");
      toast.error("Sign in failed", { description: "Invalid or expired code." });
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
    <div className="min-h-screen bg-ng-cream text-ng-ink flex flex-col lg:flex-row">
      {/* Brand panel — mirrors the admin's dark sidebar */}
      <aside className="bg-ng-forest-deep text-ng-cream/80 lg:w-[44%] flex flex-col justify-between p-8 lg:p-12">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo variant="mark" tone="white" className="h-9" />
          <span className="font-display text-[18px] text-ng-cream">Nutri Greenz</span>
        </Link>

        <div className="hidden lg:block max-w-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-ng-cream/10 px-3 py-1.5 text-[11px] uppercase tracking-wider font-mono font-semibold text-ng-clay">
            <Icon name="shield-keyhole-bold" size={14} />
            Admin · v0.4.1
          </div>
          <h2 className="font-display text-[34px] leading-tight text-ng-cream mt-6">
            Operator console
          </h2>
          <p className="font-sans text-[14px] font-medium text-ng-cream/85 mt-3 leading-relaxed">
            Manage catalog, orders, inventory and marketing for the Nutri Greenz
            storefront. Restricted to authorised operators.
          </p>
        </div>

        <p className="font-mono text-[11.5px] font-medium text-ng-cream/85">
          Secured area — activity may be monitored.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="size-12 rounded-2xl bg-ng-forest-deep text-ng-clay flex items-center justify-center mb-6">
            <Icon name="lock-keyhole-bold" size={24} />
          </div>

          <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
            Sign in to Admin
          </h1>
          <p className="font-sans text-[13.5px] font-medium text-ng-ink-muted mt-2">
            Enter your operator credentials to continue.
          </p>

          {/* Method toggle: Passcode | Phone OTP */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-ng-paper border border-ng-line p-1">
            {(["passcode", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMethod(m)}
                aria-pressed={method === m}
                className={
                  "flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-colors " +
                  (method === m
                    ? "bg-ng-forest-deep text-ng-cream"
                    : "text-ng-ink-muted hover:text-ng-ink")
                }
              >
                <Icon
                  name={m === "passcode" ? "key-minimalistic-bold" : "phone-bold"}
                  size={15}
                />
                {m === "passcode" ? "Passcode" : "Phone OTP"}
              </button>
            ))}
          </div>

          {method === "passcode" ? (
            <form onSubmit={handlePasscode} className="mt-6 flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                autoComplete="username"
                placeholder="you@nutrigreenz.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                prefix={<Icon name="letter-bold" size={18} />}
                error={error ?? undefined}
              />
              <Input
                label="Passcode"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                prefix={<Icon name="key-minimalistic-bold" size={18} />}
                error={error ?? undefined}
              />

              <div className="-mt-1 text-right">
                <Link
                  href="/admin/forgot"
                  className="text-[12px] font-sans font-semibold text-ng-clay hover:text-ng-clay-deep transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" fullWidth disabled={submitting} className="mt-1">
                <Icon name="shield-keyhole-bold" size={18} />
                {submitting ? "Signing in…" : "Sign in to Admin"}
              </Button>
            </form>
          ) : !codeSent ? (
            <form onSubmit={sendCode} className="mt-6 flex flex-col gap-4">
              <Input
                label="Mobile number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                prefix={<Icon name="phone-bold" size={18} />}
                hint="Authorised operator numbers only."
                error={error ?? undefined}
              />
              <Button type="submit" fullWidth disabled={submitting} className="mt-1">
                <Icon name="chat-round-dots-bold" size={18} />
                {submitting ? "Sending…" : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-ng-ink">
                  Enter the 6-digit code
                </span>
                <OtpInput value={code} onChange={setCode} />
                {error ? (
                  <p className="text-[12px] font-medium text-ng-danger">{error}</p>
                ) : null}
              </div>
              <Button type="submit" fullWidth disabled={submitting} className="mt-1">
                <Icon name="shield-keyhole-bold" size={18} />
                {submitting ? "Verifying…" : "Verify & sign in"}
              </Button>
              <div className="flex items-center justify-between text-[12px] font-sans font-semibold">
                <button
                  type="button"
                  disabled={resendIn > 0 || resending || submitting}
                  onClick={() => void requestCode(true)}
                  className="text-ng-clay transition-colors hover:text-ng-clay-deep disabled:cursor-not-allowed disabled:text-ng-ink-soft disabled:hover:text-ng-ink-soft"
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

          {/* Invisible reCAPTCHA target for phone OTP (abuse protection). */}
          <div id="admin-recaptcha" />

          <div className="mt-6 flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-ng-ink-muted font-mono">
            <Icon name="shield-keyhole-bold" size={13} />
            Authorised operators only
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ng-cream" aria-hidden />}>
      <LoginForm />
    </Suspense>
  );
}
