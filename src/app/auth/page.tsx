"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/ng/page-shell";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Logo } from "@/components/ng/logo";
import { OtpInput } from "@/components/ng/otp-input";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ng/motion";
import { useAuth } from "@/lib/auth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const PERKS = [
  { icon: "shield-check-bold", title: "Lab-tested, every lot", body: "Scan the code on any pack to see its harvest, farm and purity report." },
  { icon: "wallet-money-bold", title: "5% back on every order", body: "Loyalty credit you can redeem on anything in the pantry." },
  { icon: "crown-star-bold", title: "First dibs on harvests", body: "Limited-batch lots ship to members 48 hours before the public." },
];

function AuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const { sendOtp, verifyOtp, signInWithGoogle, configured, isAuthed } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (isAuthed) router.replace(next);
  }, [isAuthed, next, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const e164 = `+91${phone.replace(/\D/g, "")}`;
  const phoneValid = phone.replace(/\D/g, "").length === 10;

  async function handleSend() {
    if (!phoneValid) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setBusy(true);
    try {
      await sendOtp(e164);
      setStep("otp");
      setResendIn(30);
      toast.success(`OTP sent to ${e164}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the code");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(otp);
      toast.success("You're in — welcome!");
      router.push(next);
    } catch {
      toast.error("Invalid or expired code");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google");
      router.push(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell hidePromo hideFooter>
      <div className="min-h-[calc(100vh-68px)] grid lg:grid-cols-[1.05fr_1fr]">
        {/* LEFT — form */}
        <div className="relative flex flex-col justify-center px-6 md:px-16 py-14 bg-cream-mesh">
          <div className="relative z-10 max-w-md mx-auto w-full">
            <Logo />
            <Reveal>
              <h1 className="font-display text-[clamp(38px,4.6vw,56px)] leading-[1.02] text-ng-forest-deep mt-10">
                {step === "phone" ? (
                  <>Log in or <em className="italic text-ng-leaf">sign up</em>.</>
                ) : (
                  <>Verify your <em className="italic text-ng-leaf">number</em>.</>
                )}
              </h1>
            </Reveal>
            <p className="text-[15px] text-ng-ink-muted mt-3 leading-relaxed">
              {step === "phone"
                ? "Enter your mobile number — we'll text you a one-time code. No password needed."
                : `We sent a 6-digit code to ${e164}.`}
            </p>

            <div className="mt-9 space-y-4">
              {step === "phone" ? (
                <>
                  <Input
                    label="Mobile number"
                    inputMode="tel"
                    placeholder="98XXX XXXXX"
                    prefix={<span className="text-[15px] font-medium text-ng-ink">+91</span>}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend();
                    }}
                    maxLength={12}
                  />
                  <Button variant="primary" size="lg" fullWidth onClick={handleSend} disabled={busy}>
                    {busy ? "Sending…" : "Send OTP"}
                  </Button>
                </>
              ) : (
                <>
                  <OtpInput value={otp} onChange={setOtp} />
                  <Button variant="primary" size="lg" fullWidth onClick={handleVerify} disabled={busy}>
                    {busy ? "Verifying…" : "Verify & log in"}
                  </Button>
                  <div className="flex items-center justify-between text-[13px]">
                    <button
                      type="button"
                      disabled={resendIn > 0 || busy}
                      onClick={handleSend}
                      className="font-medium text-ng-forest hover:underline disabled:cursor-not-allowed disabled:text-ng-ink-soft disabled:no-underline"
                    >
                      {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, "0")}` : "Resend code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("phone");
                        setOtp("");
                      }}
                      className="text-ng-ink-muted hover:text-ng-forest"
                    >
                      Change number
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="my-7 flex items-center gap-3 text-[12px] text-ng-ink-soft">
              <span className="h-px flex-1 bg-ng-line" />
              <span>or</span>
              <span className="h-px flex-1 bg-ng-line" />
            </div>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleGoogle}
              disabled={busy}
              className="gap-3 bg-ng-white"
            >
              <GoogleIcon /> Continue with Google
            </Button>

            {!configured ? (
              <p className="mt-5 text-center text-[12px] leading-relaxed text-ng-ink-soft">
                <Icon name="info-circle-linear" size={13} className="mr-1 -mt-0.5" />
                Demo mode — add Firebase keys to <code className="text-ng-forest">.env.local</code> to enable live OTP &amp; Google sign-in.
              </p>
            ) : (
              <p className="mt-5 text-center text-[12px] leading-relaxed text-ng-ink-soft">
                By continuing you agree to our{" "}
                <Link href="#" className="text-ng-forest hover:underline">Terms</Link> &amp;{" "}
                <Link href="#" className="text-ng-forest hover:underline">Privacy</Link>.
              </p>
            )}
          </div>
          {/* invisible reCAPTCHA mount for Firebase Phone Auth */}
          <div id="recaptcha-container" />
        </div>

        {/* RIGHT — brand panel */}
        <div className="relative hidden overflow-hidden bg-forest-radial lg:block">
          <div aria-hidden className="absolute inset-0 aurora opacity-50" />
          <div className="relative flex h-full flex-col justify-center gap-14 p-14 text-ng-cream">
            <div>
              <Logo variant="wordmark" tone="white" />
              <h2 className="font-display text-[34px] leading-[1.15] mt-10 max-w-sm text-balance">
                Born in soil,
                <br />
                <em className="italic text-ng-leaf">built for tomorrow.</em>
              </h2>
              <ul className="mt-10 space-y-6 max-w-sm">
                {PERKS.map((p) => (
                  <li key={p.title} className="flex gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ng-leaf/15 text-ng-leaf ring-1 ring-ng-leaf/30">
                      <Icon name={p.icon} size={22} />
                    </div>
                    <div>
                      <div className="font-display text-[18px] text-ng-cream">{p.title}</div>
                      <div className="mt-1 text-[13px] leading-relaxed text-ng-cream/65">{p.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-dark max-w-md rounded-3xl p-6">
              <div className="flex items-center gap-1 text-ng-clay">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="star-bold" size={15} />
                ))}
              </div>
              <blockquote className="font-display mt-3 text-[19px] italic leading-snug text-ng-cream/95">
                &ldquo;Six months in, my whole pantry is Nutri Greenz. The lot codes turned us into believers.&rdquo;
              </blockquote>
              <footer className="mt-3 text-[12px] text-ng-cream/60">— Anjali · member since Aug 2025 · Bengaluru</footer>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<PageShell hidePromo hideFooter><div className="min-h-[calc(100vh-68px)]" /></PageShell>}>
      <AuthScreen />
    </Suspense>
  );
}
