"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { Toggle, SaveBar } from "@/components/ng/admin/super/controls";
import { Input } from "@/components/ng/input";
import { getAdminEmail, getAdminRole, type AdminRole } from "@/lib/admin-auth";

/**
 * /admin/profile — Milestone-1 placeholder for an operator's own account.
 *
 * Both Admin and Super Admin can reach this page (it is NOT super-admin gated).
 * Identity (email + role) is read from the readable display cookies; the rest
 * (name, mobile, joined, last sign-in, sessions, activity) is mocked for the
 * demo. All actions fire toasts only — live editing, password change, 2FA and
 * session management connect to Firebase + the backend in Milestone 2.
 *
 * Important: a person can edit their own name/mobile/security here, but the
 * ROLE is read-only — only a Super Admin can change someone's role (from
 * Config → Roles), so an Admin can never self-promote.
 */
function roleLabel(role: AdminRole | null): string {
  return role === "superadmin" ? "Super Admin" : "Admin";
}

const SESSIONS: { device: string; place: string; when: string; current: boolean; icon: string }[] = [
  { device: "This device · Chrome on macOS", place: "Hyderabad, IN", when: "Active now", current: true, icon: "monitor-bold" },
  { device: "Safari on iPhone", place: "Hyderabad, IN", when: "2 days ago", current: false, icon: "smartphone-bold" },
];

const ACTIVITY: { icon: string; label: string; detail: string; when: string }[] = [
  { icon: "login-3-bold", label: "Signed in", detail: "Hyderabad · Chrome on macOS", when: "Today, 9:12 AM" },
  { icon: "tuning-2-bold", label: "Updated commerce rules", detail: "Free-delivery threshold → ₹599", when: "Yesterday, 6:40 PM" },
  { icon: "pen-2-bold", label: "Edited a product", detail: "Cold-Pressed Groundnut Oil · 1L", when: "Yesterday, 2:18 PM" },
  { icon: "login-3-bold", label: "Signed in", detail: "Hyderabad · Chrome on macOS", when: "Mon, 8:55 AM" },
];

export default function AdminProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);

  // Editable identity (seeded from the email once known) + a saved snapshot
  // so the SaveBar can track "dirty" and Reset can revert.
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; mobile: string; photo: string | null }>({
    name: "",
    mobile: "",
    photo: null,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  // Super-admin sign-in factors, loaded from /api/admin/security/factors.
  const [factors, setFactors] = useState<{
    totp: boolean;
    emailOtp: boolean;
    phoneOtp: boolean;
    otpEmail: string | null;
    otpPhone: string | null;
  } | null>(null);
  const [available, setAvailable] = useState<{ totp: boolean; email: boolean; phone: boolean }>({
    totp: false,
    email: false,
    phone: false,
  });

  useEffect(() => {
    const e = getAdminEmail();
    const r = getAdminRole();
    setEmail(e);
    setRole(r);
    const guess = e
      ? e.split("@")[0].split(/[._-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(" ")
      : "Operator";
    const seed = { name: guess || "Operator", mobile: "", photo: null };
    setName(seed.name);
    setMobile(seed.mobile);
    setSaved(seed);
  }, []);

  // Load the super-admin's saved sign-in factors + which are available, and
  // prefill the mobile field from the saved OTP destination (#42) so the form
  // shows the number the mobile code is delivered to.
  useEffect(() => {
    if (role !== "superadmin") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/security/factors");
        if (!res.ok || !alive) return;
        const data = await res.json();
        const savedPhone: string | null = data.factors?.otpPhone ?? null;
        setFactors({
          totp: Boolean(data.factors?.totp),
          emailOtp: Boolean(data.factors?.emailOtp),
          phoneOtp: Boolean(data.factors?.phoneOtp),
          otpEmail: data.factors?.otpEmail ?? null,
          otpPhone: savedPhone,
        });
        setAvailable({
          totp: Boolean(data.available?.totp),
          email: Boolean(data.available?.email),
          phone: Boolean(data.available?.phone),
        });
        // Seed the editable mobile field + saved snapshot from the OTP number
        // (kept as the last 10 digits for the +91-prefixed input).
        const digits = savedPhone ? savedPhone.replace(/\D/g, "").slice(-10) : "";
        if (digits && alive) {
          setMobile(digits);
          setSaved((s) => ({ ...s, mobile: digits }));
        }
      } catch {
        /* ignore — the section just stays in its default state */
      }
    })();
    return () => {
      alive = false;
    };
  }, [role]);

  const isSuper = role === "superadmin";
  const dirty = name !== saved.name || mobile !== saved.mobile || photo !== saved.photo;
  const initial = (name.trim()[0] ?? email?.trim()?.[0] ?? "A").toUpperCase();

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name can’t be empty", { description: "Enter your full name before saving." });
      return;
    }
    const mobileDigits = mobile.trim();
    setSaved({ name: name.trim(), mobile: mobileDigits, photo });

    // Persist the profile mobile as the mobile-OTP destination (#42) so the
    // sign-in code always goes to the number shown here. The factors endpoint
    // is super-admin gated; `factors !== null` means it loaded for this user.
    if (factors && mobileDigits.length === 10) {
      const e164 = `+91${mobileDigits}`;
      try {
        const res = await fetch("/api/admin/security/factors", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ otpPhone: e164 }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setFactors((f) => (f ? { ...f, otpPhone: data.factors?.otpPhone ?? e164 } : f));
        }
      } catch {
        /* non-fatal — the rest of the profile still saved */
      }
    }

    toast.success("Profile updated", { description: "Your name, mobile and photo were saved." });
  }
  function handleReset() {
    setName(saved.name);
    setMobile(saved.mobile);
    setPhoto(saved.photo);
  }
  function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file", { description: "Choose a PNG, JPG or WebP image." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Please pick an image under 5 MB." });
      return;
    }
    setPhoto((prev) => {
      if (prev && prev !== saved.photo) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    toast.message("Photo selected", { description: "Click Save to apply — preview only (uploads in Milestone 2)." });
  }
  function removePhoto() {
    setPhoto((prev) => {
      if (prev && prev !== saved.photo) URL.revokeObjectURL(prev);
      return null;
    });
  }
  function sendReset() {
    toast.success("Reset link sent", {
      description: `We’ve emailed a password reset link to ${email ?? "your inbox"}.`,
    });
  }
  async function setFactor(key: "totp" | "emailOtp" | "phoneOtp", value: boolean) {
    const prev = factors;
    setFactors((f) => (f ? { ...f, [key]: value } : f)); // optimistic
    try {
      const res = await fetch("/api/admin/security/factors", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFactors(prev);
        const msg =
          data.error === "totp-unavailable"
            ? "Scan the authenticator QR first."
            : data.error === "email-unavailable"
              ? "Connect email (add your Brevo key) first."
              : data.error === "phone-required"
                ? "Add an operator mobile (ADMIN_PHONE) first."
                : "Couldn’t update — try again.";
        toast.error("Not updated", { description: msg });
        return;
      }
      setFactors({
        totp: Boolean(data.factors?.totp),
        emailOtp: Boolean(data.factors?.emailOtp),
        phoneOtp: Boolean(data.factors?.phoneOtp),
        otpEmail: data.factors?.otpEmail ?? null,
        otpPhone: data.factors?.otpPhone ?? null,
      });
      toast.success(value ? "Turned on" : "Turned off", {
        description: value
          ? "You’ll complete this code at sign-in."
          : "No longer required at sign-in.",
      });
    } catch {
      setFactors(prev);
      toast.error("Not updated", { description: "Couldn’t reach the server." });
    }
  }

  return (
    <AdminShell
      active="/admin/profile"
      title={
        <span>
          Your <em className="italic text-ng-clay font-display">profile</em>
        </span>
      }
      subtitle="Your account details, security and recent activity"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ---- Left column: identity + security --------------------------- */}
        <div className="lg:col-span-2 space-y-5">
          {/* Identity */}
          <Card title="Your profile">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Upload profile picture"
                    className="group relative grid place-items-center size-16 overflow-hidden rounded-2xl bg-ng-forest-deep text-ng-cream font-display text-[26px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ng-forest focus-visible:ring-offset-2 focus-visible:ring-offset-ng-paper"
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="Your profile" className="size-full object-cover" />
                    ) : (
                      <span>{initial}</span>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-ng-forest-deep/55 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Icon name="camera-bold" size={18} className="text-ng-cream" />
                    </span>
                  </button>
                  <span className="absolute -bottom-1 -right-1 grid place-items-center size-6 rounded-full bg-ng-clay text-ng-soil ring-2 ring-ng-paper pointer-events-none">
                    <Icon name="camera-bold" size={12} />
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={onPickPhoto}
                  />
                </div>
                {photo ? (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-[11px] font-semibold text-ng-terracotta hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                ) : (
                  <span className="text-[10.5px] font-medium text-ng-ink-soft">Add photo</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[20px] text-ng-forest-deep leading-tight truncate">{name || "—"}</h3>
                <div className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-ng-ink-muted">
                  <Icon name="letter-bold" size={14} className="text-ng-ink-soft shrink-0" />
                  <span className="font-mono truncate">{email ?? "admin"}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/15 text-ng-clay-deep font-bold px-2.5 py-1 text-[11px] uppercase tracking-wider">
                    <Icon name={isSuper ? "crown-bold" : "shield-keyhole-bold"} size={12} />
                    {roleLabel(role)}
                  </span>
                  <Pill tone="success">Active</Pill>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-ng-ink-soft">
                  <Icon name="info-circle-bold" size={13} className="text-ng-forest shrink-0" />
                  {isSuper
                    ? "You manage everyone’s roles in Config → Roles."
                    : "Your role is set by a Super Admin and can’t be changed here."}
                </p>
              </div>
            </div>

            {/* Editable fields */}
            <div className="mt-5 pt-5 border-t border-ng-line-soft grid sm:grid-cols-2 gap-4">
              <Input
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                prefix={<Icon name="user-circle-bold" size={18} />}
              />
              <Input
                label="Mobile number"
                type="tel"
                inputMode="tel"
                placeholder="98XXX XXXXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                prefix={<span className="text-[15px] font-medium text-ng-ink">+91</span>}
                maxLength={10}
              />
            </div>
            <SaveBar
              note="Mock save — changes aren’t persisted yet (Milestone 2)."
              dirty={dirty}
              onSave={handleSave}
              onReset={handleReset}
            />
          </Card>

          {/* Security */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <Icon name="lock-keyhole-minimalistic-linear" size={18} className="text-ng-forest" />
                Security
              </span>
            }
          >
            {/* Change password */}
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ng-ink">Password</span>
                <span className="block text-[11.5px] font-medium text-ng-ink-soft mt-0.5">
                  We’ll email you a secure link to set a new passcode.
                </span>
              </span>
              <button
                type="button"
                onClick={sendReset}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-cream transition-colors cursor-pointer"
              >
                <Icon name="key-minimalistic-bold" size={14} className="text-ng-clay-deep" />
                Send reset link
              </button>
            </div>

            <div className="border-t border-ng-line-soft" />

            {/* Sign-in methods */}
            <div className="py-3">
              <span className="block text-[13.5px] font-semibold text-ng-ink">Sign-in methods</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-success/12 text-ng-success font-semibold px-3 py-1.5 text-[12px]">
                  <Icon name="key-minimalistic-bold" size={14} />
                  Password · enabled
                </span>
                <button
                  type="button"
                  onClick={() => toast.message("Connect Google", { description: "Google sign-in links up in Milestone 2." })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink-muted font-semibold px-3 py-1.5 text-[12px] hover:bg-ng-cream transition-colors cursor-pointer"
                >
                  <Icon name="global-bold" size={14} className="text-ng-ink-soft" />
                  Google · connect
                </button>
              </div>
            </div>

            <div className="border-t border-ng-line-soft" />

            {/* Two-factor sign-in — selectable factors (super admin) */}
            {isSuper ? (
              <div className="py-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-ng-ink">Two-factor sign-in</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-ng-forest/12 text-ng-forest font-bold px-2 py-0.5 text-[9.5px] uppercase tracking-wider">
                    <Icon name="shield-check-bold" size={10} />
                    Recommended
                  </span>
                </div>
                <p className="mb-2 text-[11.5px] font-medium text-ng-ink-soft">
                  Turn on any of these — after your password you’ll complete{" "}
                  <span className="font-semibold text-ng-ink-muted">any one</span> at sign-in.
                </p>

                <Toggle
                  label="Authenticator app"
                  description="6-digit codes from Google Authenticator, Authy or 1Password."
                  checked={Boolean(factors?.totp)}
                  onChange={(v) => setFactor("totp", v)}
                />
                {!available.totp ? (
                  <p className="-mt-1.5 mb-2 ml-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-ng-clay-deep">
                    <Icon name="info-circle-bold" size={12} />
                    Scan the authenticator QR (set ADMIN_TOTP_SECRET) to enable.
                  </p>
                ) : null}

                <div className="my-1 border-t border-ng-line-soft" />

                <Toggle
                  label="Email one-time code"
                  description={`A code emailed to ${factors?.otpEmail || email || "your inbox"} on each sign-in.`}
                  checked={Boolean(factors?.emailOtp)}
                  onChange={(v) => setFactor("emailOtp", v)}
                />
                {!available.email ? (
                  <p className="-mt-1.5 ml-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-ng-clay-deep">
                    <Icon name="info-circle-bold" size={12} />
                    Connect email (add your Brevo key) to enable.
                  </p>
                ) : null}

                <div className="my-1 border-t border-ng-line-soft" />

                <Toggle
                  label="Mobile one-time code (SMS)"
                  description="A code by SMS to your operator mobile on each sign-in."
                  checked={Boolean(factors?.phoneOtp)}
                  onChange={(v) => setFactor("phoneOtp", v)}
                />
                {!available.phone ? (
                  <p className="-mt-1.5 ml-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-ng-clay-deep">
                    <Icon name="info-circle-bold" size={12} />
                    Add an operator mobile (ADMIN_PHONE) to enable.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 py-2 text-[12px] font-medium text-ng-ink-soft">
                <Icon name="shield-keyhole-bold" size={14} className="text-ng-ink-soft" />
                Two-factor sign-in is managed by your Super Admin.
              </div>
            )}

            <div className="border-t border-ng-line-soft" />

            {/* Active sessions */}
            <div className="pt-3">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[13.5px] font-semibold text-ng-ink">Active sessions</span>
                <button
                  type="button"
                  onClick={() => toast.success("Signed out everywhere", { description: "All other sessions were ended." })}
                  className="text-[12px] font-semibold text-ng-terracotta hover:underline cursor-pointer"
                >
                  Sign out everywhere
                </button>
              </div>
              <ul>
                {SESSIONS.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 border-b border-ng-line-soft last:border-0">
                    <span className="grid place-items-center size-9 rounded-xl bg-ng-cream text-ng-forest shrink-0">
                      <Icon name={s.icon} size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ng-ink truncate">{s.device}</div>
                      <div className="text-[11.5px] font-medium text-ng-ink-soft">{s.place}</div>
                    </div>
                    {s.current ? (
                      <Pill tone="success">This device</Pill>
                    ) : (
                      <span className="text-[11.5px] font-medium text-ng-ink-soft shrink-0">{s.when}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* ---- Right column: account meta + activity --------------------- */}
        <div className="space-y-5">
          <Card title="Account">
            <dl className="space-y-3.5">
              {[
                { k: "Role", icon: isSuper ? "crown-bold" : "shield-keyhole-bold", v: roleLabel(role) },
                { k: "Status", icon: "check-circle-bold", v: "Active" },
                { k: "Member since", icon: "calendar-minimalistic-bold", v: "12 May 2026" },
                { k: "Last sign-in", icon: "clock-circle-bold", v: "Today, 9:12 AM" },
                { k: "Location", icon: "map-point-bold", v: "Hyderabad, IN" },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ng-ink-muted">
                    <Icon name={row.icon} size={15} className="text-ng-ink-soft" />
                    {row.k}
                  </dt>
                  <dd className="text-[13px] font-semibold text-ng-ink tabular-nums">{row.v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Recent activity">
            <ol>
              {ACTIVITY.map((e, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5 border-b border-ng-line-soft last:border-0">
                  <span className="grid place-items-center size-8 rounded-lg bg-ng-forest/10 text-ng-forest shrink-0 mt-0.5">
                    <Icon name={e.icon} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ng-ink">{e.label}</div>
                    <div className="text-[11.5px] font-medium text-ng-ink-soft">{e.detail}</div>
                  </div>
                  <span className="text-[11px] font-medium text-ng-ink-soft tabular-nums shrink-0 mt-0.5">{e.when}</span>
                </li>
              ))}
            </ol>
            <p className="text-[11.5px] font-medium text-ng-ink-soft mt-4 flex items-center gap-1.5">
              <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
              A full personal audit trail ships in Milestone 2.
            </p>
          </Card>
        </div>

        {/* ---- Footer note ---------------------------------------------- */}
        <p className="lg:col-span-3 text-[11.5px] font-medium text-ng-ink-soft flex items-center gap-1.5">
          <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
          Placeholder screen — live profile editing, password change, two-factor &amp; session management connect in Milestone 2.
        </p>
      </div>
    </AdminShell>
  );
}
