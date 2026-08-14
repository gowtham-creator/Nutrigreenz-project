"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { OtpInput } from "@/components/ng/otp-input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { auth, firebaseConfig } from "@/lib/firebase";
import {
  GOOGLE_ENRICH_EVENT,
  type GoogleEnrichDetail,
} from "@/lib/google-enrich-client";
import {
  announcePhoneVerified,
  PHONE_VERIFY_REQUEST_EVENT,
} from "@/lib/phone-verify-client";

/**
 * Additive, SKIPPABLE mobile-capture prompt (Task T3 — customer-identity dedup).
 *
 * Shown only after a GOOGLE sign-in when the signed-in user has no verified
 * phone yet. The user enters their mobile and OTP-verifies it. We link the
 * number to the LIVE Google session with `linkWithPhoneNumber`; when the number
 * already belongs to a prior phone-only account (`auth/credential-already-in-use`
 * — exactly the duplicate we want to merge), we re-verify it through a SECONDARY,
 * throwaway Firebase app so the primary Google session is never touched. Either
 * way we POST the resulting PHONE id token to `/api/auth/link-phone`, which
 * merges the two canonical customers server-side.
 *
 * Non-breaking guarantees: it never calls the primary `signOut`, every failure
 * is swallowed/toasted softly, and "Skip" sets a per-account localStorage flag
 * so it never nags again. If anything is unconfigured it renders nothing.
 */

const DISMISS_PREFIX = "ng.link-phone.dismissed.";
const RECAPTCHA_ID = "ng-link-phone-recaptcha";

function dismissedKey(uid: string): string {
  return `${DISMISS_PREFIX}${uid}`;
}

function toE164(localTenDigits: string): string {
  return `+91${localTenDigits.replace(/\D/g, "")}`;
}

/**
 * Best-effort: reduce a People-API E.164 number to the 10-digit local form the
 * input expects. Strips a leading +91 / 91 country code; keeps the last 10 digits
 * when that's all that's left (Indian mobiles). Returns "" when it can't.
 */
function toLocalTenDigits(e164: string): string {
  let digits = e164.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length === 10 ? digits : "";
}

export function LinkPhonePrompt() {
  const { user, configured } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Live Firebase confirmation handle (primary-link OR secondary-app flow).
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  // Reused invisible reCAPTCHA verifier (cleared before every send).
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  // The throwaway secondary app, when the number belongs to a prior account.
  const secondaryRef = useRef<FirebaseApp | null>(null);

  useEffect(() => setMounted(true), []);

  // Decide whether to auto-show: real Google session, no phone yet, not skipped.
  useEffect(() => {
    if (!configured || !user) return;
    // A user that already has a verified phone (phone sign-in or already linked)
    // needs no capture. `user.phoneNumber` is set once a phone is linked.
    if (user.phoneNumber) return;
    // Only prompt Google-provider users (phone-only users came in by phone).
    const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
    if (!isGoogle) return;
    let skipped = false;
    try {
      skipped = window.localStorage.getItem(dismissedKey(user.uid)) === "1";
    } catch {
      skipped = true; // storage blocked → don't nag
    }
    if (skipped) return;

    let cancelled = false;
    let timer: number | undefined;
    // The phone may already be linked SERVER-SIDE (verified on another device)
    // even though this Firebase user has no `phoneNumber` — check the canonical
    // customer before nagging, so a returning Google user isn't re-prompted.
    void (async () => {
      try {
        const res = await fetch("/api/account/me", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { customer?: { phone?: string | null } } | null;
        if (data?.customer?.phone) {
          try {
            window.localStorage.setItem(dismissedKey(user.uid), "1");
          } catch {
            /* storage blocked — fine */
          }
          return; // already verified → never prompt
        }
      } catch {
        /* best-effort — fall through and prompt as before */
      }
      if (!cancelled) timer = window.setTimeout(() => setOpen(true), 900);
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [configured, user]);

  // Task T6 — when the People-API enrichment found a phone that COLLIDES with
  // another customer, the server returns it as `prefillPhone` (it is NEVER
  // auto-merged). Open this prompt PRE-FILLED so the user OTP-verifies it — the
  // takeover-safe step that actually merges the two canonical customers. We open
  // even if the prompt was previously "skipped": this is a specific, collision-
  // driven ask, not the generic capture nag.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEnrich = (event: Event) => {
      const detail = (event as CustomEvent<GoogleEnrichDetail>).detail;
      const local = detail?.prefillPhone ? toLocalTenDigits(detail.prefillPhone) : "";
      if (!local) return;
      setStep("phone");
      setOtp("");
      setError(null);
      setDone(false);
      setPhone(local);
      setOpen(true);
    };
    window.addEventListener(GOOGLE_ENRICH_EVENT, onEnrich);
    return () => window.removeEventListener(GOOGLE_ENRICH_EVENT, onEnrich);
  }, []);

  // Checkout welcome-coupon flow (money + identity sensitive): a welcome /
  // first-order code only validates once the customer owns an OTP-verified phone.
  // When the coupon field requests it, open this prompt FRESH so they can verify
  // inline — even if they previously "skipped" the generic capture nag, because
  // this is a specific, coupon-driven ask rather than the passive prompt.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRequest = () => {
      setStep("phone");
      setPhone("");
      setOtp("");
      setError(null);
      setDone(false);
      setOpen(true);
    };
    window.addEventListener(PHONE_VERIFY_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(PHONE_VERIFY_REQUEST_EVENT, onRequest);
  }, []);

  // Escape + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeForNow();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function cleanup() {
    verifierRef.current?.clear();
    verifierRef.current = null;
    confirmationRef.current = null;
    if (secondaryRef.current) {
      void deleteApp(secondaryRef.current).catch(() => {});
      secondaryRef.current = null;
    }
  }

  // Close WITHOUT the permanent flag — used by the X / backdrop / Escape, so a
  // casual or accidental close (or closing after an error) re-prompts next time
  // instead of suppressing the link step forever.
  function closeForNow() {
    cleanup();
    setOpen(false);
  }

  // Explicit "Skip for now" — set the per-account flag so it won't auto-nag again.
  function dismiss() {
    if (user) {
      try {
        window.localStorage.setItem(dismissedKey(user.uid), "1");
      } catch {
        /* ignore */
      }
    }
    closeForNow();
  }

  /** Mint a fresh invisible reCAPTCHA verifier against the given Auth instance. */
  function freshVerifier(authInstance: Auth) {
    verifierRef.current?.clear();
    const verifier = new RecaptchaVerifier(authInstance, RECAPTCHA_ID, {
      size: "invisible",
    });
    verifierRef.current = verifier;
    return verifier;
  }

  async function handleSend() {
    setError(null);
    const local = phone.replace(/\D/g, "");
    if (local.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!auth || !user) {
      setError("Sign-in isn't ready, please try again.");
      return;
    }
    setBusy(true);
    const e164 = toE164(local);
    try {
      // Always verify on a SECONDARY, isolated Firebase app: we only need a
      // verified phone id token — the server links/merges the canonical customer.
      // This works whether or not the number already belongs to a prior phone
      // account, and avoids linkWithPhoneNumber's confirm-time
      // `credential-already-in-use` (which surfaced as a misleading "code expired"
      // on the merge path).
      await sendViaSecondary(e164);
      setStep("otp");
      setOtp("");
    } catch (err) {
      setError(friendlySendError((err as { code?: string })?.code ?? ""));
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  /** Send an OTP through a throwaway secondary Firebase app (never touches the
   *  primary session). The confirmation is stashed exactly like the primary path. */
  async function sendViaSecondary(e164: string) {
    // One isolated app instance per attempt; named so it can't clash with the
    // default app. Cleaned up on dismiss / completion.
    if (secondaryRef.current) {
      await deleteApp(secondaryRef.current).catch(() => {});
      secondaryRef.current = null;
    }
    const secondary = initializeApp(firebaseConfig, `phone-verify-${Date.now()}`);
    secondaryRef.current = secondary;
    const secondaryAuth = getAuth(secondary);
    confirmationRef.current = await signInWithPhoneNumber(
      secondaryAuth,
      e164,
      freshVerifier(secondaryAuth),
    );
  }

  async function handleVerify() {
    setError(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError("Request a code first.");
      return;
    }
    setBusy(true);
    try {
      const cred = await confirmation.confirm(otp);
      const idToken = await cred.user.getIdToken();

      // If this was the secondary-app flow, drop that throwaway session NOW so
      // it can never leak into the primary app state.
      if (secondaryRef.current) {
        await signOut(getAuth(secondaryRef.current)).catch(() => {});
      }

      // Hand the verified PHONE id token to the server, which merges the two
      // canonical customers (older row survives). Best-effort by contract.
      await fetch("/api/auth/link-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      }).catch(() => {});

      // Refresh the primary user's token so a freshly-linked phone is reflected.
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true).catch(() => {});
      }

      // Tell any waiting checkout coupon field the phone is now verified + linked
      // (the server attach above has completed), so it can re-validate + apply the
      // pending welcome code automatically. No-op when nothing is listening.
      announcePhoneVerified();

      setDone(true);
      // Mark dismissed so it never re-prompts for this account.
      if (user) {
        try {
          window.localStorage.setItem(dismissedKey(user.uid), "1");
        } catch {
          /* ignore */
        }
      }
      cleanup();
      window.setTimeout(() => setOpen(false), 1400);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      setError(
        code === "auth/invalid-verification-code"
          ? "That code is incorrect. Check it and re-enter."
          : code === "auth/code-expired"
            ? "Your code expired. Request a new one."
            : "Couldn't verify the code. Request a fresh one and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ng-link-phone-title"
    >
      <div
        className="absolute inset-0 bg-ng-forest-deep/50 backdrop-blur-sm motion-safe:animate-[fadeIn_.25s_ease]"
        onClick={closeForNow}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden bg-ng-paper shadow-[var(--shadow-ng-float)]",
          "rounded-t-3xl sm:rounded-3xl sm:mx-4",
          "motion-safe:animate-[popIn_.32s_cubic-bezier(0.32,0.72,0,1)]",
        )}
      >
        {/* Leafy header band */}
        <div className="relative bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-leaf px-6 pb-7 pt-7 text-ng-paper">
          <button
            type="button"
            onClick={closeForNow}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-ng-paper/80 hover:bg-ng-paper/15 hover:text-ng-paper transition-colors"
          >
            <Icon name="close-circle-linear" size={20} />
          </button>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-ng-paper/15">
            <Icon name="phone-bold" size={26} className="text-ng-paper" />
          </span>
          <h2 id="ng-link-phone-title" className="mt-3 font-display text-[24px] leading-tight">
            {done ? "You're all set" : "Add your mobile number"}
          </h2>
          <p className="mt-1 text-[13px] text-ng-paper/80">
            {done
              ? "Your mobile is verified and linked to your account."
              : step === "phone"
                ? "Verify your mobile so your orders and addresses stay in one place."
                : `Enter the 6-digit code we sent to ${toE164(phone)}.`}
          </p>
        </div>

        <div className="px-6 pb-6 pt-5">
          {done ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Icon name="check-circle-bold" size={40} className="text-ng-leaf" />
            </div>
          ) : step === "phone" ? (
            <div className="flex flex-col gap-3">
              <Input
                label="Mobile number"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98XXX XXXXX"
                prefix={<span className="text-[15px] font-medium text-ng-ink">+91</span>}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSend();
                }}
                maxLength={12}
                error={error ?? undefined}
              />
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => void handleSend()}
                disabled={busy}
              >
                {busy ? "Sending…" : "Send OTP"}
              </Button>
              <button
                type="button"
                onClick={dismiss}
                className="mx-auto mt-1 text-[13px] font-medium text-ng-ink-muted hover:text-ng-forest transition-colors"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <OtpInput value={otp} onChange={setOtp} />
              {error ? <p className="text-[12px] text-ng-danger">{error}</p> : null}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => void handleVerify()}
                disabled={busy}
              >
                {busy ? "Verifying…" : "Verify & link"}
              </Button>
              <div className="mx-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={busy}
                  className="text-[13px] font-medium text-ng-forest hover:text-ng-leaf transition-colors disabled:opacity-50"
                >
                  Resend code
                </button>
                <span className="text-ng-ink-muted/40" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError(null);
                    cleanup();
                  }}
                  className="text-[13px] font-medium text-ng-ink-muted hover:text-ng-forest transition-colors"
                >
                  Change number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invisible reCAPTCHA mount for Firebase phone verification. */}
      <div id={RECAPTCHA_ID} />
    </div>,
    document.body,
  );
}

/** Map a Firebase send-error code to a friendly line (mirrors admin login). */
function friendlySendError(code: string): string {
  switch (code) {
    case "auth/operation-not-allowed":
      return "Phone verification isn't enabled yet. Please try again later.";
    case "auth/invalid-app-credential":
    case "auth/captcha-check-failed":
      return "Verification check failed, please retry.";
    case "auth/invalid-phone-number":
      return "That mobile number looks invalid.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and retry.";
    default:
      return `Couldn't send the code${code ? ` (${code})` : ""}.`;
  }
}
