"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/ng/logo";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";
import { BrandIcon } from "@/components/ui/brand-icon";
import { ADMIN_VERSION_LABEL } from "@/lib/app-version";

/**
 * /admin/reset — complete an operator password reset from an emailed link.
 *
 * The reset token arrives as `?token=…`; it is read from the URL on mount (so
 * this page needs no Suspense/searchParams prerender dance) and POSTed together
 * with the new password to `/api/admin/reset`, which verifies the signature,
 * expiry, and single-use state server-side. This page never sees the operator's
 * identity — only the opaque token. Chrome mirrors /admin/forgot + /admin/login
 * so the auth screens read as one continuous flow.
 */
export default function AdminResetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing or invalid. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));

      if (res.ok && data.ok) {
        setDone(true);
        toast.success("Password updated", {
          description: "You can now sign in with your new passcode.",
        });
      } else if (data.error === "weak-password") {
        setError("That password is too weak. Use at least 8 characters.");
      } else {
        setError("This reset link is invalid or has expired. Request a new one.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ng-cream text-ng-ink flex flex-col lg:flex-row">
      <aside className="login-gradient relative overflow-hidden lg:w-[44%] flex flex-col justify-between p-8 lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16] mix-blend-luminosity"
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
            {ADMIN_VERSION_LABEL}
          </div>
          <h2 className="font-display text-[34px] leading-tight text-ng-forest-deep mt-5">
            Choose a new passcode
          </h2>
          <p className="font-sans text-[14px] font-medium text-ng-ink-muted mt-3 leading-relaxed">
            Pick something strong you don't use elsewhere. This link works once
            and expires 30 minutes after it was sent.
          </p>
        </div>

        <p className="relative z-10 w-fit rounded-full bg-ng-paper/75 px-3.5 py-1.5 font-mono text-[11.5px] font-medium text-ng-forest backdrop-blur-md">
          Secured area — activity may be monitored.
        </p>
      </aside>

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
        <div className="relative z-10 w-full max-w-sm rounded-3xl bg-ng-paper/[0.94] p-7 shadow-[var(--shadow-ng-modal)] backdrop-blur-md sm:p-8">
          {/* `ng-on-dark` keeps this disc dark in BOTH themes. Without it the disc
                inverts to near-white while the leaf glyph on it stays light green —
                1.38:1, a lock nobody can see. Pinned, it is 10.56:1. */}
            <div className="ng-on-dark size-12 rounded-full bg-ng-forest-deep text-ng-leaf flex items-center justify-center mb-6">
            <BrandIcon name="key" weight="solid" size={24} />
          </div>

          {done ? (
            <>
              <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
                Password updated
              </h1>
              <p className="font-sans text-[13.5px] font-medium text-ng-ink-muted mt-2">
                Your operator passcode has been changed. Sign in with your new
                password to continue.
              </p>
              <Link href="/admin/login" className="mt-7 block">
                <Button fullWidth>
                  <BrandIcon name="signIn" weight="solid" size={18} />
                  Go to sign in
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
                Set a new passcode
              </h1>
              <p className="font-sans text-[13.5px] font-medium text-ng-ink-muted mt-2">
                Choose a new password for your operator account.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  prefix={<BrandIcon name="lock" weight="solid" size={18} />}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  prefix={<BrandIcon name="lock" weight="solid" size={18} />}
                  error={error ?? undefined}
                />

                <Button type="submit" fullWidth disabled={submitting} className="mt-1">
                  <Icon name="check-circle-bold" size={18} />
                  {submitting ? "Saving…" : "Update password"}
                </Button>
              </form>
            </>
          )}

          <div className="mt-6">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-sans font-medium text-ng-ink-muted hover:text-ng-forest-deep transition-colors"
            >
              <Icon name="arrow-left-linear" size={15} />
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
