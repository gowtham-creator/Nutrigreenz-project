"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/ng/logo";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";

/**
 * /admin/forgot — Milestone-1 placeholder for operator password recovery.
 * "Send reset link" validates the email locally and fires a success toast;
 * there is NO API call. Real reset-link delivery (Firebase / Brevo) ships in
 * Milestone 2. This page is intentionally pre-login and publicly reachable.
 */
export default function AdminForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      const msg = "Enter a valid email address.";
      setError(msg);
      toast.error("Couldn’t send reset link", { description: msg });
      return;
    }

    setSubmitting(true);
    // M2: POST /api/admin/send-forgot-email — mocked for the demo.
    toast.success("Reset link sent", {
      description: `If an account exists for ${email.trim()}, a reset link is on its way.`,
    });
    setEmail("");
    setSubmitting(false);
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
          <div className="inline-flex items-center gap-2 rounded-full bg-ng-cream/10 px-3 py-1.5 text-[11px] uppercase tracking-wider font-mono text-ng-clay">
            <Icon name="shield-keyhole-bold" size={14} />
            Admin · v0.4.1
          </div>
          <h2 className="font-display text-[34px] leading-tight text-ng-cream mt-6">
            Reset your access
          </h2>
          <p className="font-sans text-[14px] text-ng-cream/55 mt-3 leading-relaxed">
            We’ll email a secure link to reset your operator passcode. For
            security, the link expires shortly after it’s sent.
          </p>
        </div>

        <p className="font-mono text-[11px] text-ng-cream/35">
          Secured area — activity may be monitored.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="size-12 rounded-2xl bg-ng-forest-deep text-ng-clay flex items-center justify-center mb-6">
            <Icon name="key-minimalistic-bold" size={24} />
          </div>

          <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
            Forgot your passcode?
          </h1>
          <p className="font-sans text-[13.5px] text-ng-ink-soft mt-2">
            Enter your operator email and we’ll send a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
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

            <Button type="submit" fullWidth disabled={submitting} className="mt-1">
              <Icon name="letter-bold" size={18} />
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>

          <div className="mt-6">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-sans text-ng-ink-soft hover:text-ng-forest-deep transition-colors"
            >
              <Icon name="alt-arrow-left-bold" size={15} />
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
