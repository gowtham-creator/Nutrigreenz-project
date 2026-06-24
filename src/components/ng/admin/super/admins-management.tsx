"use client";

/**
 * Super Admin · Admins management (Milestone-1 placeholder).
 *
 * Interactive roster with an "Add / Invite admin" modal and per-row actions
 * (resend invite, reset password, change role, deactivate). Everything is
 * LOCAL STATE + sonner toasts only — real invite emails/SMS, password resets,
 * Google OAuth and persisted role changes land in Milestone 2.
 */

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ng/admin/admin-shell";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";

type RoleKey = "admin" | "superadmin";
type Channel = "email" | "sms" | "whatsapp";

type AdminUser = {
  name: string;
  email: string;
  mobile?: string;
  role: RoleKey;
  lastActive: string;
  status: "active" | "invited";
};

type NewAdminPayload = { name: string; email: string; phone: string; password: string };

const labelChannel = (c: string) => (c === "email" ? "Email" : c === "sms" ? "SMS" : "WhatsApp");

/** Map an API admin record to the roster's display shape. */
function recordToUser(a: {
  name: string | null;
  email: string;
  phone: string | null;
  role: RoleKey;
  status: string;
  lastLoginAt: string | null;
}): AdminUser {
  return {
    name: a.name || a.email.split("@")[0],
    email: a.email,
    mobile: a.phone ?? undefined,
    role: a.role,
    lastActive: a.lastLoginAt ? "Recently" : "—",
    status: a.status === "active" ? "active" : "invited",
  };
}

const roleLabel = (r: RoleKey) => (r === "superadmin" ? "Super Admin" : "Admin");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const GRID = "grid grid-cols-[1.3fr_1.7fr_1fr_0.8fr_1.1fr] gap-3";

/* ---- a compact ghost icon button used in the actions column ----------- */
function RowAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center size-8 rounded-lg text-ng-ink-soft transition-colors cursor-pointer",
        danger ? "hover:bg-ng-terracotta/10 hover:text-ng-terracotta" : "hover:bg-ng-line-soft hover:text-ng-forest-deep",
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

export function AdminsManagement() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [open, setOpen] = useState(false);

  // Load the real, DB-backed admins.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/admins");
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (Array.isArray(data.admins)) setAdmins(data.admins.map(recordToUser));
      } catch {
        /* ignore — the roster just stays empty */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleInvite(payload: NewAdminPayload, channels: Channel[]): Promise<boolean> {
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, channels }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "exists"
            ? "That email is already an admin."
            : data.error === "db-unavailable"
              ? "The database isn't configured yet."
              : "Couldn’t add the admin — check the details.";
        toast.error("Not added", { description: msg });
        return false;
      }
      setAdmins((prev) => [...prev, recordToUser(data.admin)]);
      const sent = (data.sent ?? []).map(labelChannel).join(", ");
      const pending = (data.pending ?? []).map(labelChannel).join(", ");
      toast.success("Admin added", {
        description:
          `${data.admin.email} created as Admin.` +
          (sent ? ` Credentials sent via ${sent}.` : "") +
          (pending ? ` Pending (no provider yet): ${pending}.` : ""),
      });
      return true;
    } catch {
      toast.error("Not added", { description: "Couldn’t reach the server." });
      return false;
    }
  }

  function resendInvite(a: AdminUser) {
    toast.success("Invite resent", { description: `${a.email} will get a fresh set-up link.` });
  }

  function resetPassword(a: AdminUser) {
    toast.success("Password reset sent", { description: `A reset link is on its way to ${a.email}.` });
  }

  function changeRole(a: AdminUser) {
    const next: RoleKey = a.role === "superadmin" ? "admin" : "superadmin";
    setAdmins((prev) => prev.map((x) => (x.email === a.email ? { ...x, role: next } : x)));
    toast.success("Role updated", { description: `${a.name} is now ${roleLabel(next)}.` });
  }

  function deactivate(a: AdminUser) {
    // M1: toast only — no list mutation; real deactivation ships in Milestone 2.
    toast.success("Admin deactivated", { description: `${a.email} can no longer sign in.` });
  }

  return (
    <div className="mt-6 pt-5 border-t border-ng-line-soft">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[13px] font-semibold text-ng-ink flex items-center gap-2">
          <Icon name="users-group-rounded-bold" size={16} className="text-ng-forest" />
          Admin users
        </span>
        <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
          <Icon name="add-circle-bold" size={16} />
          Add admin
        </Button>
      </div>

      {/* column header */}
      <div
        className={cn(
          GRID,
          "px-1 pb-2 mb-1 border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold",
        )}
      >
        <span>Name</span>
        <span>Email</span>
        <span>Role</span>
        <span className="text-right">Last active</span>
        <span className="text-right">Actions</span>
      </div>

      <ul>
        {admins.length === 0 ? (
          <li className="px-1 py-6 text-center text-[12.5px] font-medium text-ng-ink-soft">
            No admins yet — click “Add admin” to create one.
          </li>
        ) : null}
        {admins.map((a) => (
          <li
            key={a.email}
            className={cn(GRID, "px-1 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0")}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="grid place-items-center size-7 rounded-full bg-ng-forest/10 text-ng-forest text-[11px] font-bold shrink-0">
                {a.name.charAt(0)}
              </span>
              <span className="font-semibold text-ng-ink truncate">{a.name}</span>
              {a.status === "invited" ? <Pill tone="neutral">Invited</Pill> : null}
            </span>
            <span className="font-mono text-[12px] font-medium text-ng-ink-muted truncate">{a.email}</span>
            <span>
              {a.role === "superadmin" ? <Pill tone="warn">Super Admin</Pill> : <Pill tone="info">Admin</Pill>}
            </span>
            <span className="text-right text-[12px] font-medium text-ng-ink-soft tabular-nums">{a.lastActive}</span>
            <span className="flex items-center justify-end gap-0.5">
              {a.status === "invited" ? (
                <RowAction icon="refresh-bold" label="Resend invite" onClick={() => resendInvite(a)} />
              ) : null}
              <RowAction icon="lock-keyhole-minimalistic-bold" label="Reset password" onClick={() => resetPassword(a)} />
              <RowAction icon="shield-user-bold" label="Change role" onClick={() => changeRole(a)} />
              <RowAction icon="trash-bin-trash-linear" label="Deactivate" onClick={() => deactivate(a)} danger />
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11.5px] font-medium text-ng-ink-soft mt-4 flex items-center gap-1.5">
        <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
        Add admin is live (creates a real account). Row actions — resend, reset &amp; deactivate — ship next.
      </p>

      <AddInviteAdminModal open={open} onClose={() => setOpen(false)} onInvite={handleInvite} />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Add / Invite admin modal (mirrors stock-adjust-dialog a11y pattern).     */
/* ----------------------------------------------------------------------- */
function AddInviteAdminModal({
  open,
  onClose,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (payload: NewAdminPayload, channels: Channel[]) => Promise<boolean>;
}) {
  const headingId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["email"]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; mobile?: string; password?: string }>({});

  // reset + focus on open
  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setMobile("");
    setPassword("");
    setChannels(["email"]);
    setErrors({});
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // escape + scroll-lock
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&";
    const buf = new Uint32Array(16);
    crypto.getRandomValues(buf);
    setPassword(Array.from(buf, (n) => chars[n % chars.length]).join(""));
    setErrors((e) => ({ ...e, password: undefined }));
  }

  function toggleChannel(c: Channel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleInvite() {
    const digits = mobile.replace(/\D/g, "");
    const next: { name?: string; email?: string; mobile?: string; password?: string } = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (digits.length !== 10) next.mobile = "Enter a 10-digit mobile number.";
    if (password.trim().length < 8) next.password = "Set a password (min 8 characters).";
    setErrors(next);
    if (next.name || next.email || next.mobile || next.password) {
      toast.error("Couldn’t send invite", { description: "Fill in every field correctly." });
      return;
    }
    if (channels.length === 0) {
      toast.error("Pick a delivery channel", {
        description: "Send credentials via Email, SMS or WhatsApp.",
      });
      return;
    }
    setSubmitting(true);
    const ok = await onInvite(
      { name: name.trim(), email: email.trim(), phone: digits, password },
      channels,
    );
    setSubmitting(false);
    if (ok) onClose();
  }

  const CHANNELS: { key: Channel; label: string; icon: string }[] = [
    { key: "email", label: "Email", icon: "letter-bold" },
    { key: "sms", label: "SMS", icon: "chat-round-dots-bold" },
    { key: "whatsapp", label: "WhatsApp", icon: "chat-round-call-bold" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close invite dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-[1px] cursor-pointer"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-[480px] rounded-2xl bg-ng-cream border border-ng-line-soft shadow-[0_24px_64px_rgba(31,77,46,0.22)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ng-line-soft bg-ng-paper">
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-[20px] text-ng-forest-deep leading-tight">
              Add / Invite admin
            </h2>
            <p className="text-[12px] font-medium text-ng-ink-soft mt-1">They’ll receive an invite to set up access.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 size-9 rounded-full flex items-center justify-center text-ng-ink-soft hover:bg-ng-line-soft hover:text-ng-forest-deep transition-colors cursor-pointer"
          >
            <Icon name="close-circle-bold" size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Input
            ref={firstFieldRef}
            label="Full name"
            placeholder="e.g. Priya Nair"
            value={name}
            onChange={(e) => setName(e.target.value)}
            prefix={<Icon name="user-circle-bold" size={18} />}
            error={errors.name ?? undefined}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@nutrigreenz.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            prefix={<Icon name="letter-bold" size={18} />}
            error={errors.email ?? undefined}
          />
          <Input
            label="Mobile number"
            type="tel"
            inputMode="tel"
            placeholder="98XXX XXXXX"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            prefix={<span className="text-[15px] font-medium text-ng-ink">+91</span>}
            maxLength={10}
            error={errors.mobile ?? undefined}
          />

          {/* Password + auto-generate */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ng-ink">Password</span>
              <button
                type="button"
                onClick={generatePassword}
                className="text-[12px] font-semibold text-ng-clay-deep hover:text-ng-clay transition-colors cursor-pointer"
              >
                Auto-generate
              </button>
            </div>
            <Input
              type="text"
              placeholder="Set or auto-generate"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefix={<Icon name="key-minimalistic-bold" size={18} />}
              error={errors.password ?? undefined}
            />
          </div>

          {/* Send credentials via */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ng-ink">Send credentials via</span>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => {
                const active = channels.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleChannel(c.key)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12.5px] transition-colors cursor-pointer",
                      active
                        ? "border-ng-forest bg-ng-forest text-ng-paper font-semibold"
                        : "border-ng-line bg-ng-paper text-ng-ink-muted font-medium hover:border-ng-leaf",
                    )}
                  >
                    <Icon name={c.icon} size={15} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] font-medium text-ng-ink-soft">
              New users are added as <span className="font-semibold text-ng-ink-muted">Admin</span> and must change the password on first sign-in.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ng-line-soft bg-ng-paper">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={handleInvite} disabled={submitting}>
            <Icon name="letter-bold" size={16} />
            {submitting ? "Adding…" : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
