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
import { SegToggle } from "@/components/ng/admin/super/controls";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";

type RoleKey = "admin" | "superadmin";
type InviteMethod = "link" | "google";

type AdminUser = {
  name: string;
  email: string;
  role: RoleKey;
  lastActive: string;
  status: "active" | "invited";
};

const SEED: AdminUser[] = [
  { name: "Owner", email: "admin@nutrigreenz.in", role: "superadmin", lastActive: "Just now", status: "active" },
  { name: "Priya Nair", email: "priya@nutrigreenz.in", role: "admin", lastActive: "2h ago", status: "active" },
  { name: "Rahul Verma", email: "rahul@nutrigreenz.in", role: "admin", lastActive: "Yesterday", status: "active" },
  { name: "Ops Desk", email: "ops@nutrigreenz.in", role: "admin", lastActive: "—", status: "invited" },
];

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
  const [admins, setAdmins] = useState<AdminUser[]>(SEED);
  const [open, setOpen] = useState(false);

  function handleInvite(newAdmin: AdminUser, method: InviteMethod) {
    setAdmins((prev) => [...prev, newAdmin]);
    toast.success("Admin invited", {
      description: `${newAdmin.email} added as ${roleLabel(newAdmin.role)} (${
        method === "link" ? "set-password link" : "Google sign-in"
      }).`,
    });
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
        Placeholder actions — real invites, resets &amp; role changes ship in Milestone 2.
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
  onInvite: (admin: AdminUser, method: InviteMethod) => void;
}) {
  const headingId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<RoleKey>("admin");
  const [method, setMethod] = useState<InviteMethod>("link");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  // reset + focus on open
  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setMobile("");
    setRole("admin");
    setMethod("link");
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

  function handleInvite() {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (next.name || next.email) {
      toast.error("Couldn’t send invite", { description: "Name and a valid email are required." });
      return;
    }
    onInvite({ name: name.trim(), email: email.trim(), role, lastActive: "—", status: "invited" }, method);
    onClose();
  }

  const ROLE_OPTS: { key: RoleKey; label: string; icon: string }[] = [
    { key: "admin", label: "Admin", icon: "shield-keyhole-bold" },
    { key: "superadmin", label: "Super Admin", icon: "crown-bold" },
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
            label="Mobile (optional)"
            type="tel"
            placeholder="+91 ·····"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            prefix={<Icon name="phone-bold" size={18} />}
          />

          {/* Role selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ng-ink-muted">Role</span>
            <div role="radiogroup" aria-label="Role" className="grid grid-cols-2 gap-2">
              {ROLE_OPTS.map((o) => {
                const active = role === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(o.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] transition-colors cursor-pointer",
                      active
                        ? "border-ng-forest bg-ng-forest text-ng-paper font-semibold"
                        : "border-ng-line bg-ng-paper text-ng-ink-muted font-medium hover:border-ng-leaf",
                    )}
                  >
                    <Icon name={o.icon} size={16} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invite method */}
          <SegToggle
            label="Invite method"
            value={method}
            onChange={setMethod}
            options={[
              { value: "link", label: "Set-password link" },
              { value: "google", label: "Google sign-in" },
            ]}
            hint={
              method === "link"
                ? "They set their own passcode via the emailed link."
                : "They sign in with their Google workspace account."
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ng-line-soft bg-ng-paper">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={handleInvite}>
            <Icon name="letter-bold" size={16} />
            Send invite
          </Button>
        </div>
      </div>
    </div>
  );
}
