"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/ng/logo";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
            Operator console
          </h2>
          <p className="font-sans text-[14px] text-ng-cream/55 mt-3 leading-relaxed">
            Manage catalog, orders, inventory and marketing for the Nutri Greenz
            storefront. Restricted to authorised operators.
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
            <Icon name="lock-keyhole-bold" size={24} />
          </div>

          <h1 className="font-display text-[28px] text-ng-forest-deep leading-tight">
            Sign in to Admin
          </h1>
          <p className="font-sans text-[13.5px] text-ng-ink-soft mt-2">
            Enter your operator credentials to continue.
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
                className="text-[12px] font-sans text-ng-clay hover:text-ng-clay-deep transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth disabled={submitting} className="mt-1">
              <Icon name="shield-keyhole-bold" size={18} />
              {submitting ? "Signing in…" : "Sign in to Admin"}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ng-ink-soft font-mono">
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
    <Suspense
      fallback={<div className="min-h-screen bg-ng-cream" aria-hidden />}
    >
      <LoginForm />
    </Suspense>
  );
}
