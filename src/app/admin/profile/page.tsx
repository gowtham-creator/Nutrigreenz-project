"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { Toggle, TextField, SaveBar } from "@/components/ng/admin/super/controls";
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
  const [saved, setSaved] = useState({ name: "", mobile: "" });
  const [twoFA, setTwoFA] = useState(false);

  useEffect(() => {
    const e = getAdminEmail();
    const r = getAdminRole();
    setEmail(e);
    setRole(r);
    const guess = e
      ? e.split("@")[0].split(/[._-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(" ")
      : "Operator";
    const seed = { name: guess || "Operator", mobile: "+91 98480 12345" };
    setName(seed.name);
    setMobile(seed.mobile);
    setSaved(seed);
  }, []);

  const isSuper = role === "superadmin";
  const dirty = name !== saved.name || mobile !== saved.mobile;
  const initial = (name.trim()[0] ?? email?.trim()?.[0] ?? "A").toUpperCase();

  function handleSave() {
    if (!name.trim()) {
      toast.error("Name can’t be empty", { description: "Enter your full name before saving." });
      return;
    }
    setSaved({ name: name.trim(), mobile: mobile.trim() });
    // M2: PATCH /api/admin/me — mocked for the demo.
    toast.success("Profile updated", { description: "Your name and mobile were saved." });
  }
  function handleReset() {
    setName(saved.name);
    setMobile(saved.mobile);
  }
  function sendReset() {
    toast.success("Reset link sent", {
      description: `We’ve emailed a password reset link to ${email ?? "your inbox"}.`,
    });
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
              <span className="grid place-items-center size-16 shrink-0 rounded-2xl bg-ng-forest-deep text-ng-cream font-display text-[26px]">
                {initial}
              </span>
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
              <TextField label="Full name" value={name} onChange={setName} placeholder="Your full name" />
              <TextField label="Mobile number" value={mobile} onChange={setMobile} placeholder="+91 …" />
            </div>
            <SaveBar
              note="Mock save — changes aren’t persisted yet (Milestone 2)."
              dirty={dirty}
              onSave={handleSave}
              onReset={handleReset}
            />
          </Card>

          {/* Security */}
          <Card title="Security">
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

            {/* Two-factor */}
            <div className="flex items-center justify-between gap-4 py-1">
              <Toggle
                label={
                  <span className="inline-flex items-center gap-2">
                    Two-factor authentication
                    {isSuper ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ng-forest/12 text-ng-forest font-bold px-2 py-0.5 text-[9.5px] uppercase tracking-wider">
                        <Icon name="shield-check-bold" size={10} />
                        Recommended
                      </span>
                    ) : null}
                  </span>
                }
                description="A one-time code by SMS / authenticator on every new sign-in."
                checked={twoFA}
                onChange={(v) => {
                  setTwoFA(v);
                  toast[v ? "success" : "message"](v ? "Two-factor enabled" : "Two-factor disabled", {
                    description: v ? "You’ll be asked for a code at next sign-in." : "Codes are no longer required.",
                  });
                }}
              />
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
