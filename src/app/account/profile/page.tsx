"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ngToast } from "@/components/ng/toast";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Input } from "@/components/ng/input";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { BellIcon } from "@/components/ui/bell-icon";
import { AppIcon } from "@/components/ui/app-icon";
import { Reveal } from "@/components/ng/motion";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"] as const;

/*
 * The label shown and the value stored are not the same string.
 *
 * `customers_gender_chk` accepts only female / male / other /
 * prefer_not_to_say, so posting the display label would fail the constraint and
 * the whole save would 422 — including the unrelated fields in the same
 * request. Mapped in both directions here so the wording stays an editorial
 * choice rather than a schema change.
 */
const GENDER_VALUE: Record<string, string> = {
  Female: "female",
  Male: "male",
  "Non-binary": "other",
  "Prefer not to say": "prefer_not_to_say",
};
const GENDER_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(GENDER_VALUE).map(([label, value]) => [value, label]),
);
const DIETS = ["Vegetarian", "Vegan", "Jain", "Eggetarian", "No preference"] as const;

type PrefKey = "whatsapp" | "sms" | "email" | "orders";

const PREFS: { key: PrefKey; label: string; desc: string; icon: string }[] = [
  { key: "whatsapp", label: "WhatsApp updates", desc: "Harvest drops, restocks and offers on WhatsApp.", icon: "chat-round-line-bold" },
  { key: "sms", label: "SMS updates", desc: "Occasional texts for time-sensitive offers.", icon: "smartphone-bold" },
  { key: "email", label: "Email newsletter", desc: "The monthly harvest letter and recipes.", icon: "letter-bold" },
  { key: "orders", label: "Order updates", desc: "Dispatch, delivery and trace alerts. Recommended.", icon: "box-bold" },
];

function formatPhone(phone: string): string {
  // "+919876543210" → "+91 98765 43210"
  const m = phone.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

export default function ProfilePage() {
  const { account, isAuthed, updateProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [gender, setGender] = useState<string>("");

  // Reflect the signed-in account (or empty when signed out / a brand-new
  // account) — no sample data ever bleeds across different accounts.
  useEffect(() => {
    setFullName(account?.name ?? "");
    setEmail(account?.email ?? "");
  }, [account]);

  // Canonical customer profile (name/email/phone from public.customers). A phone
  // merged in via the link-phone flow lives HERE, not on the Firebase user — so
  // this is what makes a verified mobile actually show up for a Google session.
  const [canonical, setCanonical] = useState<{
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null>(null);
  useEffect(() => {
    if (!isAuthed) {
      setCanonical(null);
      return;
    }
    let active = true;
    fetch("/api/account/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        const c = (d?.customer ?? null) as {
          name: string | null;
          email: string | null;
          phone: string | null;
          dob?: string | null;
          gender?: string | null;
          dietPrefs?: string[];
          notify?: Record<PrefKey, boolean>;
        } | null;
        setCanonical(c);
        // Fill name/email from the canonical record when the Firebase user has
        // none (a phone login) — so a merged Google identity's details show.
        if (c) {
          setFullName((cur) => cur || c.name || "");
          setEmail((cur) => cur || c.email || "");
          /*
           * The saved fields are assigned rather than defaulted-if-empty.
           *
           * An unticked toggle and an unloaded one are both `false`, so the
           * `cur || …` idiom used for the text fields would silently discard a
           * stored preference of "off" and show the default of "on". These are
           * consent flags; showing the wrong state is not a cosmetic bug.
           */
          setDob(c.dob ?? "");
          setGender(c.gender ? (GENDER_LABEL[c.gender] ?? "") : "");
          if (c.dietPrefs?.length) setDiets(c.dietPrefs);
          if (c.notify) setPrefs(c.notify);
        }
        // Set regardless of whether a row came back. A brand-new account has no
        // customers row yet, and leaving this false would disable Save forever
        // for exactly the people most likely to be filling the form in.
        setLoaded(true);
      })
      .catch(() => {
        // A failed read must not lock the form. Saving still works; it would
        // just be writing over defaults, which is what an empty form does anyway.
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [isAuthed, account]);

  const effectivePhone = account?.phone || canonical?.phone || null;
  // A phone only lands in the canonical record once it's OTP-verified, so any
  // present number here is verified — whether you signed in by phone OR linked it
  // to a Google account. Badge/helper key off this, not the login method.
  const hasVerifiedPhone = Boolean(effectivePhone);
  const displayPhone = effectivePhone ? formatPhone(effectivePhone) : "Not added yet";

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    whatsapp: true,
    sms: false,
    email: true,
    orders: true,
  });

  const [diets, setDiets] = useState<string[]>(["Vegetarian"]);

  const togglePref = (key: PrefKey) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const toggleDiet = (d: string) =>
    setDiets((prev) =>
      d === "No preference"
        ? ["No preference"]
        : prev.includes(d)
          ? prev.filter((x) => x !== d)
          : [...prev.filter((x) => x !== "No preference"), d],
    );

  const [saving, setSaving] = useState(false);

  /*
   * Save to the server, and only claim success once it has actually saved.
   *
   * This previously called a React state setter and then announced "Your
   * details and preferences have been updated". Nothing was written: every
   * value was gone on the next refresh, while the customer had been told
   * otherwise. A toast that lies is worse than no toast, because it stops
   * anyone reporting the bug.
   */
  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const res = await fetch("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          dob,
          gender: gender ? (GENDER_VALUE[gender] ?? "") : "",
          dietPrefs: diets,
          notify: prefs,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        ngToast.error("Could not save", {
          // 422 carries a message naming the offending field; anything else
          // gets a generic line rather than leaking a server error.
          description:
            res.status === 422 && data?.error
              ? data.error
              : res.status === 401
                ? "Your session has expired. Please sign in again."
                : "Something went wrong. Please try again.",
        });
        return;
      }

      // Keep the header/avatar in step with what was just saved.
      updateProfile({ name: fullName, email });
      ngToast.success("Profile saved", {
        description: "Your details and preferences have been updated.",
      });
    } catch {
      ngToast.error("Could not save", {
        description: "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountShell active="profile">
      <form onSubmit={onSave} className="space-y-8">
        {!isAuthed ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-ng-leaf/40 bg-ng-sage/30 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ng-paper text-ng-forest ring-1 ring-ng-leaf/30">
                <Icon name="lock-keyhole-minimalistic-bold" size={18} />
              </span>
              <div>
                <div className="text-[15px] font-medium text-ng-forest-deep">Sign in to manage your profile</div>
                <p className="mt-0.5 text-[13px] leading-snug text-ng-ink-soft">
                  You&apos;re viewing sample details. Sign in to save changes to your account.
                </p>
              </div>
            </div>
            <Button variant="primary" size="md" className="shrink-0" asChild>
              <Link href="/auth?next=/account/profile">Sign in</Link>
            </Button>
          </div>
        ) : null}
        {/* Header — forest-gradient band gives the page a branded, premium anchor */}
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep p-7 text-ng-cream shadow-[var(--shadow-ng-card)] ring-1 ring-ng-leaf/15 md:p-9">
            <div aria-hidden className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-ng-leaf/25 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-ng-forest-soft/50 blur-3xl" />
            <div className="relative">
              <span className="ng-eyebrow inline-flex items-center gap-2 text-ng-leaf">
                <Icon name="user-bold" size={14} />
                Your account
              </span>
              <h1 className="mt-2.5 max-w-xl font-display text-[clamp(30px,4vw,44px)] leading-[1.05]">
                Profile &amp; <em className="italic text-ng-leaf">preferences</em>
              </h1>
              <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ng-cream/70">
                Keep your details current so deliveries reach you and we only send what you actually
                want to hear about.
              </p>
              {hasVerifiedPhone ? (
                <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-ng-cream/10 px-3 py-1.5 text-[12px] font-medium text-ng-cream ring-1 ring-ng-cream/15 backdrop-blur-sm">
                  <Icon name="verified-check-bold" size={14} className="text-ng-green-bright" />
                  Mobile verified · {displayPhone}
                </span>
              ) : null}
            </div>
          </div>
        </Reveal>

        {/* Account details */}
        <section className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)] md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
              <Icon name="user-bold" size={20} />
            </span>
            <div>
              <h2 className="font-display text-[22px] leading-none text-ng-forest-deep">Account details</h2>
              <p className="mt-1 text-[13px] text-ng-ink-soft">The basics on your Nutrigreenz account.</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              prefix={<Icon name="user-linear" size={18} />}
            />

            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              prefix={<AppIcon name="email" size={18} />}
            />

            {/* Phone — verified, read-only OTP identity */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-ng-ink-muted">Phone number</label>
              <div
                className={cn(
                  "flex h-12 items-center gap-2 rounded-xl border px-4",
                  hasVerifiedPhone ? "border-ng-leaf/40 bg-ng-leaf/[0.07]" : "border-ng-line bg-ng-sage/25",
                )}
              >
                <span className={hasVerifiedPhone ? "text-ng-forest" : "text-ng-ink-soft"}>
                  <Icon name="phone-bold" size={18} />
                </span>
                <span className="flex-1 text-[15px] font-mono text-ng-ink">{displayPhone}</span>
                {hasVerifiedPhone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ng-forest">
                    <Icon name="verified-check-bold" size={13} className="text-ng-green-bright" />
                    Verified
                  </span>
                ) : null}
              </div>
              <p className="text-[12px] text-ng-ink-soft">
                {hasVerifiedPhone
                  ? "Your verified mobile. Used to sign in and for delivery updates."
                  : "Add a phone number at checkout for delivery updates."}
              </p>
            </div>

            <Input
              label="Date of birth (optional)"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              prefix={<Icon name="calendar-linear" size={18} />}
              hint="We slip a birthday treat into your wallet a month before."
            />

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[13px] font-medium text-ng-ink-muted">Gender (optional)</label>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((g) => {
                  const on = gender === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(on ? "" : g)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-4 py-2 text-[13px] font-medium transition-colors",
                        on
                          ? "border-ng-forest bg-ng-forest text-ng-cream"
                          : "border-ng-line bg-ng-paper text-ng-ink-muted hover:border-ng-leaf hover:bg-ng-sage/40",
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Communication preferences */}
        <section className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)] md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
              <BellIcon size={20} />
            </span>
            <div>
              <h2 className="font-display text-[22px] leading-none text-ng-forest-deep">Communication preferences</h2>
              <p className="mt-1 text-[13px] text-ng-ink-soft">Choose how (and how much) we reach out.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PREFS.map((p) => {
              const on = prefs[p.key];
              return (
                <label
                  key={p.key}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                    on ? "border-ng-leaf/50 bg-ng-sage/30" : "border-ng-line-soft bg-ng-paper hover:border-ng-line",
                  )}
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ng-paper text-ng-forest ring-1 ring-ng-line-soft">
                    <Icon name={p.icon} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ng-forest-deep">{p.label}</div>
                    <div className="mt-0.5 text-[12.5px] leading-snug text-ng-ink-soft">{p.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={p.label}
                    onClick={() => togglePref(p.key)}
                    className={cn(
                      "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                      on ? "bg-ng-forest" : "bg-ng-line",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-ng-paper shadow-sm transition-transform duration-200",
                        on && "translate-x-5",
                      )}
                    />
                  </button>
                </label>
              );
            })}
          </div>
        </section>

        {/* Dietary preferences */}
        <section className="rounded-3xl border border-ng-line-soft bg-ng-paper p-6 shadow-[var(--shadow-ng-card)] md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
              <Icon name="leaf-bold" size={20} />
            </span>
            <div>
              <h2 className="font-display text-[22px] leading-none text-ng-forest-deep">Dietary preferences</h2>
              <p className="mt-1 text-[13px] text-ng-ink-soft">Optional — helps us tailor recipes and picks for you.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {DIETS.map((d) => {
              const on = diets.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDiet(d)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors",
                    on
                      ? "border-ng-forest bg-ng-forest text-ng-cream"
                      : "border-ng-line bg-ng-paper text-ng-ink-muted hover:border-ng-leaf hover:bg-ng-sage/40",
                  )}
                >
                  {on ? <Icon name="check-circle-bold" size={15} className="text-ng-cream" /> : null}
                  {d}
                </button>
              );
            })}
          </div>
        </section>

        {/* Save bar */}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-[12px] text-ng-ink-soft sm:mr-auto">
            {isAuthed
              ? "Saved to your account, on every device."
              : "Sign in to save your details."}
          </p>
          {/*
            Disabled until the stored profile has loaded. Saving before then
            would post the component's defaults over whatever is on the record —
            silently switching a customer's notification choices back on.
          */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={saving || !isAuthed || !loaded}
          >
            <Icon name={saving ? "refresh-bold" : "diskette-bold"} size={18} className={saving ? "animate-spin" : undefined} />
            {saving ? "Saving\u2026" : "Save changes"}
          </Button>
        </div>
      </form>
    </AccountShell>
  );
}
