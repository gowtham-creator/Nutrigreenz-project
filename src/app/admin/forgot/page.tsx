"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/ng/logo";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";
import { BrandIcon } from "@/components/ui/brand-icon";
import { ADMIN_VERSION_LABEL } from "@/lib/app-version";
import { UiIcon } from "@/components/ui/ui-icon";

/**
 * /admin/forgot — operator password recovery.
 * "Send reset link" POSTs the email to `/api/admin/forgot`, which — for a known
 * operator — mints a signed, single-use, 30-minute token and emails a
 * `/admin/reset` link via Brevo. The endpoint ALWAYS returns a generic success
 * (no account-enumeration), so this page shows the same confirmation regardless
 * of whether the email exists. This page is intentionally pre-login and public.
 *
 * Chrome matches /admin/login exactly (the animated `.login-gradient` brand +
 * form panels, floating glows, rising particles, the paper card, and the
 * leaf-accented auth badge) so moving between the two auth screens reads as one
 * continuous flow rather than two different products.
 */
export default function AdminForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = email.trim();
    if (!value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      const msg = "Enter a valid email address.";
      setError(msg);
      toast.error("Couldn’t send reset link", { description: msg });
      return;
    }

    setSubmitting(true);
    try {
      // The endpoint always returns a generic success — it never reveals whether
      // the account exists — so we show the same confirmation either way.
      await fetch("/api/admin/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      toast.success("Reset link sent", {
        description: `If an account exists for ${value}, a reset link is on its way.`,
      });
      setEmail("");
    } catch {
      toast.error("Couldn’t send reset link", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ng-cream text-ng-ink flex flex-col lg:flex-row">
      {/* Brand panel — moving forest gradient + floating glows + rising
          particles (mirrors /admin/login); the forest photo remains a faint
          texture layer underneath. */}
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
            Reset your access
          </h2>
          <p className="font-sans text-[14px] font-medium text-ng-ink-muted mt-3 leading-relaxed">
            We’ll email a secure link to reset your operator passcode. For
            security, the link expires shortly after it’s sent.
          </p>
        </div>

        <p className="relative z-10 w-fit rounded-full bg-ng-paper/75 px-3.5 py-1.5 font-mono text-[11.5px] font-medium text-ng-forest backdrop-blur-md">
          Secured area — activity may be monitored.
        </p>
      </aside>

      {/* Form panel — the deep forest moving gradient continues across the
          whole screen; the form floats on a cream paper card (matches login). */}
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

          <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
            Forgot your passcode?
          </h1>
          <p className="font-sans text-[13.5px] font-medium text-ng-ink-muted mt-2">
            Enter your operator email and we’ll send a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@nutrigreenz.farm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              prefix={<UiIcon name="email" size={18} />}
              error={error ?? undefined}
            />

            <Button type="submit" fullWidth disabled={submitting} className="mt-1">
              <UiIcon name="email" size={18} />
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>

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
