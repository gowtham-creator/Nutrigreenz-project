"use client";

/**
 * Super Admin · Admins management.
 *
 * Interactive roster backed by the `public.admins` table. Supports adding an
 * admin (with a copyable credentials hand-off), editing name/mobile/role/status,
 * resetting the password (revealed once), activating/deactivating, resending
 * credentials and deleting. All mutations go through the super-admin-gated
 * `/api/admin/admins` endpoints.
 */

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ng/admin/admin-shell";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";

type RoleKey = "admin" | "superadmin";
type StatusKey = "active" | "invited" | "disabled";
type Channel = "email" | "sms" | "whatsapp";

/** Which sign-in factors an admin has enabled (mirrors admin_security). */
type FactorFlags = { emailOtp: boolean; phoneOtp: boolean; totp: boolean };
const NO_FACTORS: FactorFlags = { emailOtp: false, phoneOtp: false, totp: false };

type AdminUser = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: RoleKey;
  status: StatusKey;
  lastLoginAt: string | null;
  factors: FactorFlags;
};

type AdminRecord = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: RoleKey;
  status: string;
  lastLoginAt: string | null;
  factors?: FactorFlags;
};

type NewAdminPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  factors: FactorFlags;
};
type Credentials = { email: string; password: string };

const labelChannel = (c: string) => (c === "email" ? "Email" : c === "sms" ? "SMS" : "WhatsApp");

function toStatus(s: string): StatusKey {
  return s === "disabled" ? "disabled" : s === "invited" ? "invited" : "active";
}

/** Map an API admin record to the roster's display shape. */
function recordToUser(a: AdminRecord): AdminUser {
  return {
    id: a.id,
    name: a.name || a.email.split("@")[0],
    email: a.email,
    mobile: a.phone ?? undefined,
    role: a.role,
    status: toStatus(a.status),
    lastLoginAt: a.lastLoginAt,
    factors: a.factors ?? { ...NO_FACTORS },
  };
}

/** Turn an ISO timestamp into a short "x ago" label. */
function humanizeLastActive(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const GRID = "grid grid-cols-[1.2fr_1.6fr_0.8fr_0.8fr_0.9fr_1.2fr] gap-3";

/** Copy text to the clipboard with a small confirmation toast. */
async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied", { description: `${what} copied to clipboard.` });
  } catch {
    toast.error("Couldn’t copy", { description: "Copy it manually instead." });
  }
}

/* ---- a compact ghost icon button used in the actions column ----------- */
function RowAction({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "grid place-items-center size-8 rounded-lg text-ng-ink-soft transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        danger ? "hover:bg-ng-terracotta/10 hover:text-ng-terracotta" : "hover:bg-ng-line-soft hover:text-ng-forest-deep",
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/* ---- a read-only credential field with a copy button ------------------ */
function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-ng-ink-soft font-semibold">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-ng-line bg-ng-paper px-3 py-2">
        <span className={cn("flex-1 text-[13px] text-ng-ink truncate", mono && "font-mono")}>{value}</span>
        <button
          type="button"
          onClick={() => copyText(value, label)}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="grid place-items-center size-7 rounded-md text-ng-ink-soft hover:bg-ng-line-soft hover:text-ng-forest-deep transition-colors cursor-pointer"
        >
          <Icon name="copy-bold" size={15} />
        </button>
      </div>
    </div>
  );
}

/* ---- the copyable credentials hand-off panel -------------------------- */
function CredentialsPanel({
  title,
  creds,
  onDismiss,
}: {
  title: string;
  creds: Credentials;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-ng-leaf bg-ng-sage/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-ng-forest-deep flex items-center gap-2">
          <Icon name="key-minimalistic-bold" size={16} className="text-ng-forest" />
          {title}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss credentials"
          className="grid place-items-center size-7 rounded-md text-ng-ink-soft hover:bg-ng-line-soft hover:text-ng-forest-deep transition-colors cursor-pointer"
        >
          <Icon name="close-circle-bold" size={16} />
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 mt-3">
        <CopyField label="Email" value={creds.email} mono />
        <CopyField label="Password" value={creds.password} mono />
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        <p className="text-[11.5px] font-medium text-ng-ink-soft">
          Shown once — copy and share it now. It can’t be retrieved again.
        </p>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => copyText(`Email: ${creds.email}\nPassword: ${creds.password}`, "Credentials")}
        >
          <Icon name="copy-bold" size={15} />
          Copy both
        </Button>
      </div>
    </div>
  );
}

export function AdminsManagement() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [staffEmail, setStaffEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [created, setCreated] = useState<Credentials | null>(null);
  const [reset, setReset] = useState<Credentials | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Load the real, DB-backed admins.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/admins");
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (Array.isArray(data.admins)) setAdmins(data.admins.map(recordToUser));
        if (typeof data.staffEmail === "string") setStaffEmail(data.staffEmail);
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
            : data.error === "phone-exists"
              ? "This number already belongs to an admin."
              : data.error === "weak-password"
                ? "Use at least 12 characters for the password."
                : data.error === "db-unavailable"
                  ? "The database isn’t configured yet."
                  : "Couldn’t add the admin — check the details.";
        toast.error("Not added", { description: msg });
        return false;
      }
      setAdmins((prev) => [...prev, recordToUser({ ...data.admin, factors: payload.factors })]);
      setReset(null);
      setCreated({ email: data.admin.email, password: payload.password });
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

  async function handleEdit(
    id: string,
    patch: { name: string; phone: string; role: RoleKey; status: StatusKey; factors: FactorFlags },
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/admins/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Not saved", { description: "Couldn’t update the admin — check the details." });
        return false;
      }
      setAdmins((prev) =>
        prev.map((x) => (x.id === id ? recordToUser({ ...data.admin, factors: patch.factors }) : x)),
      );
      toast.success("Changes saved", { description: `${data.admin.email} updated.` });
      return true;
    } catch {
      toast.error("Not saved", { description: "Couldn’t reach the server." });
      return false;
    }
  }

  async function credentialAction(a: AdminUser, action: "reset-password" | "resend") {
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/admin/admins/${a.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.password) {
        toast.error("Action failed", { description: "Couldn’t update the password." });
        return;
      }
      setCreated(null);
      setReset({ email: data.email, password: data.password });
      const sent: string[] = Array.isArray(data.sent) ? data.sent : [];
      if (action === "resend") {
        toast.success("Credentials regenerated", {
          description: sent.includes("admin")
            ? `New password emailed to ${a.email}.`
            : `New password ready for ${a.email} — copy it below.`,
        });
      } else {
        const emailedAdmin = sent.includes("admin");
        const emailedYou = sent.includes("you");
        const note =
          emailedAdmin && emailedYou
            ? ` Also emailed to ${a.email} and to you.`
            : emailedAdmin
              ? ` Also emailed to ${a.email}.`
              : "";
        toast.success("Password reset", {
          description: `New password ready for ${a.email} — copy it below.${note}`,
        });
      }
    } catch {
      toast.error("Action failed", { description: "Couldn’t reach the server." });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(a: AdminUser) {
    const next: StatusKey = a.status === "disabled" ? "active" : "disabled";
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/admin/admins/${a.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Action failed", { description: "Couldn’t change the status." });
        return;
      }
      setAdmins((prev) => prev.map((x) => (x.id === a.id ? recordToUser(data.admin) : x)));
      toast.success(next === "disabled" ? "Admin deactivated" : "Admin activated", {
        description:
          next === "disabled" ? `${a.email} can no longer sign in.` : `${a.email} can sign in again.`,
      });
    } catch {
      toast.error("Action failed", { description: "Couldn’t reach the server." });
    } finally {
      setBusyId(null);
    }
  }

  async function removeAdmin(a: AdminUser) {
    if (!window.confirm(`Remove ${a.email}? This permanently deletes the account.`)) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/admin/admins/${a.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Not removed", { description: "Couldn’t delete the admin." });
        return;
      }
      setAdmins((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Admin removed", { description: `${a.email} has been deleted.` });
    } catch {
      toast.error("Not removed", { description: "Couldn’t reach the server." });
    } finally {
      setBusyId(null);
    }
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
        <span>Status</span>
        <span>Last active</span>
        <span className="text-right">Actions</span>
      </div>

      <ul>
        {admins.length === 0 && !staffEmail ? (
          <li className="px-1 py-6 text-center text-[12.5px] font-medium text-ng-ink-soft">
            No admins yet — click “Add admin” to create one.
          </li>
        ) : null}

        {staffEmail ? (
          <li className={cn(GRID, "px-1 py-3 items-center text-[13px] border-b border-ng-line-soft")}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="grid place-items-center size-7 rounded-full bg-ng-clay/15 text-ng-clay-deep text-[11px] font-bold shrink-0">
                <Icon name="server-minimalistic-bold" size={14} />
              </span>
              <span className="font-semibold text-ng-ink truncate">Built-in</span>
              <Pill tone="neutral">Env</Pill>
            </span>
            <span className="font-mono text-[12px] font-medium text-ng-ink-muted truncate">{staffEmail}</span>
            <span>
              <Pill tone="info">Admin</Pill>
            </span>
            <span>
              <Pill tone="success">Active</Pill>
            </span>
            <span className="text-[12px] font-medium text-ng-ink-soft">Always on</span>
            <span className="text-right text-[11.5px] font-medium text-ng-ink-soft">
              Password is env-configured
            </span>
          </li>
        ) : null}

        {admins.map((a) => (
          <li
            key={a.id}
            className={cn(GRID, "px-1 py-3 items-center text-[13px] border-b border-ng-line-soft last:border-0")}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="grid place-items-center size-7 rounded-full bg-ng-forest/10 text-ng-forest text-[11px] font-bold shrink-0">
                {a.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-ng-ink truncate">{a.name}</span>
            </span>
            <span className="font-mono text-[12px] font-medium text-ng-ink-muted truncate">{a.email}</span>
            <span>
              {a.role === "superadmin" ? <Pill tone="warn">Super Admin</Pill> : <Pill tone="info">Admin</Pill>}
            </span>
            <span>
              {a.status === "disabled" ? (
                <Pill tone="danger">Deactivated</Pill>
              ) : a.status === "invited" ? (
                <Pill tone="neutral">Invited</Pill>
              ) : (
                <Pill tone="success">Active</Pill>
              )}
            </span>
            <span className="text-[12px] font-medium text-ng-ink-soft tabular-nums">
              {humanizeLastActive(a.lastLoginAt)}
            </span>
            <span className="flex items-center justify-end gap-0.5">
              <RowAction icon="pen-new-square-bold" label="Edit" onClick={() => setEditing(a)} disabled={busyId === a.id} />
              <RowAction
                icon="key-bold"
                label="Reset password"
                onClick={() => credentialAction(a, "reset-password")}
                disabled={busyId === a.id}
              />
              <RowAction
                icon="plain-2-bold"
                label="Resend credentials"
                onClick={() => credentialAction(a, "resend")}
                disabled={busyId === a.id}
              />
              <RowAction
                icon={a.status === "disabled" ? "play-bold" : "pause-bold"}
                label={a.status === "disabled" ? "Activate" : "Deactivate"}
                onClick={() => toggleStatus(a)}
                disabled={busyId === a.id}
              />
              <RowAction
                icon="trash-bin-trash-bold"
                label="Delete"
                onClick={() => removeAdmin(a)}
                danger
                disabled={busyId === a.id}
              />
            </span>
          </li>
        ))}
      </ul>

      {created ? (
        <CredentialsPanel
          title="Credentials created — copy & share"
          creds={created}
          onDismiss={() => setCreated(null)}
        />
      ) : null}
      {reset ? (
        <CredentialsPanel
          title="New password — copy & share"
          creds={reset}
          onDismiss={() => setReset(null)}
        />
      ) : null}

      <p className="text-[11.5px] font-medium text-ng-ink-soft mt-4 flex items-center gap-1.5">
        <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
        Passwords are stored hashed — a reset reveals the new one only once, so copy it before dismissing.
      </p>

      {open ? <AddInviteAdminModal onClose={() => setOpen(false)} onInvite={handleInvite} /> : null}
      {editing ? (
        <EditAdminModal key={editing.id} admin={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Shared switch + per-admin sign-in factor selector.                       */
/* ----------------------------------------------------------------------- */
/** iOS-style switch with a clearly visible knob (white + shadow + ring). */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer",
        checked ? "bg-ng-forest" : "bg-ng-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

const FACTOR_OPTIONS: { key: keyof FactorFlags; label: string; desc: string; icon: string }[] = [
  { key: "emailOtp", label: "Email OTP", desc: "A one-time code is emailed at sign-in.", icon: "letter-bold" },
  {
    key: "phoneOtp",
    label: "Phone OTP",
    desc: "A one-time code is sent to their mobile (app phone verification) at sign-in.",
    icon: "chat-round-dots-bold",
  },
  {
    key: "totp",
    label: "Authenticator app",
    desc: "They scan a QR to set up Google / Microsoft Authenticator on their next sign-in.",
    icon: "key-minimalistic-bold",
  },
];

/** The three per-admin sign-in factors, each toggled independently. */
function SecurityFactors({
  value,
  onChange,
}: {
  value: FactorFlags;
  onChange: (next: FactorFlags) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ng-ink">Sign-in security</span>
      <div className="divide-y divide-ng-line-soft rounded-xl border border-ng-line bg-ng-paper">
        {FACTOR_OPTIONS.map((f) => (
          <div key={f.key} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ng-line-soft text-ng-forest-deep">
              <Icon name={f.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ng-ink">{f.label}</div>
              <p className="text-[11px] font-medium leading-snug text-ng-ink-soft">{f.desc}</p>
            </div>
            <Switch
              checked={value[f.key]}
              onChange={(v) => onChange({ ...value, [f.key]: v })}
              label={`Toggle ${f.label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Add / Invite admin modal (mirrors stock-adjust-dialog a11y pattern).     */
/* ----------------------------------------------------------------------- */
function AddInviteAdminModal({
  onClose,
  onInvite,
}: {
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
  const [factors, setFactors] = useState<FactorFlags>({ ...NO_FACTORS });
  const [submitting, setSubmitting] = useState(false);
  const [mobileTaken, setMobileTaken] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; mobile?: string; password?: string }>({});

  // focus the first field on mount, restore focus on unmount
  useEffect(() => {
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  // escape + scroll-lock
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Live "while typing" duplicate-mobile check (debounced ~400ms).
  const mobileDigits = mobile.replace(/\D/g, "");
  useEffect(() => {
    if (mobileDigits.length !== 10) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/admins/check-phone?phone=${mobileDigits}`);
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (!alive) return;
        setMobileTaken(Boolean(data?.exists));
        if (data?.exists) {
          setErrors((e) => ({ ...e, mobile: "This number already belongs to an admin." }));
        }
      } catch {
        /* ignore — the final POST still guards against duplicates */
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [mobileDigits]);

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
    else if (mobileTaken) next.mobile = "This number already belongs to an admin.";
    if (password.length < 12) next.password = "Use at least 12 characters.";
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
      { name: name.trim(), email: email.trim(), phone: digits, password, factors },
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
        className="relative w-full max-w-[480px] rounded-2xl bg-ng-cream border border-ng-line-soft shadow-[var(--shadow-ng-modal)] overflow-hidden"
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
            onChange={(e) => {
              setMobile(e.target.value);
              setMobileTaken(false);
              setErrors((prev) => ({ ...prev, mobile: undefined }));
            }}
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
              placeholder="Set or auto-generate (min 12 characters)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              prefix={<Icon name="key-minimalistic-bold" size={18} />}
              error={errors.password ?? undefined}
            />
          </div>

          {/* Sign-in security (per-admin factors) */}
          <SecurityFactors value={factors} onChange={setFactors} />

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
          <Button variant="primary" type="button" onClick={handleInvite} disabled={submitting || mobileTaken}>
            <Icon name="letter-bold" size={16} />
            {submitting ? "Adding…" : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Edit admin modal — name, mobile, role, status.                           */
/* ----------------------------------------------------------------------- */
function EditAdminModal({
  admin,
  onClose,
  onSave,
}: {
  admin: AdminUser;
  onClose: () => void;
  onSave: (
    id: string,
    patch: { name: string; phone: string; role: RoleKey; status: StatusKey; factors: FactorFlags },
  ) => Promise<boolean>;
}) {
  const headingId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // The modal is keyed by admin id, so it remounts per row — initialise once.
  const [name, setName] = useState(admin.name);
  const [mobile, setMobile] = useState((admin.mobile ?? "").replace(/\D/g, "").slice(-10));
  const [role, setRole] = useState<RoleKey>(admin.role);
  const [active, setActive] = useState(admin.status !== "disabled");
  const [factors, setFactors] = useState<FactorFlags>({ ...NO_FACTORS, ...admin.factors });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});

  // focus the first field on mount, restore focus on unmount
  useEffect(() => {
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  // escape + scroll-lock
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleSave() {
    const digits = mobile.replace(/\D/g, "");
    const next: { name?: string; mobile?: string } = {};
    if (!name.trim()) next.name = "Name is required.";
    if (digits.length !== 10) next.mobile = "Enter a 10-digit mobile number.";
    setErrors(next);
    if (next.name || next.mobile) {
      toast.error("Couldn’t save", { description: "Fill in every field correctly." });
      return;
    }
    setSubmitting(true);
    const ok = await onSave(admin.id, {
      name: name.trim(),
      phone: digits,
      role,
      status: active ? "active" : "disabled",
      factors,
    });
    setSubmitting(false);
    if (ok) onClose();
  }

  const ROLE_OPTIONS: { key: RoleKey; label: string }[] = [
    { key: "admin", label: "Admin" },
    { key: "superadmin", label: "Super Admin" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close edit dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-[1px] cursor-pointer"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-[480px] rounded-2xl bg-ng-cream border border-ng-line-soft shadow-[var(--shadow-ng-modal)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ng-line-soft bg-ng-paper">
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-[20px] text-ng-forest-deep leading-tight">
              Edit admin
            </h2>
            <p className="text-[12px] font-medium text-ng-ink-soft mt-1 truncate">{admin.email}</p>
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

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ng-ink">Role</span>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => {
                const selected = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRole(r.key)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12.5px] transition-colors cursor-pointer",
                      selected
                        ? "border-ng-forest bg-ng-forest text-ng-paper font-semibold"
                        : "border-ng-line bg-ng-paper text-ng-ink-muted font-medium hover:border-ng-leaf",
                    )}
                  >
                    <Icon name="shield-user-bold" size={15} />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign-in security (per-admin factors) */}
          <SecurityFactors value={factors} onChange={setFactors} />

          {/* Status */}
          <div className="flex items-center justify-between rounded-xl border border-ng-line bg-ng-paper px-4 py-3">
            <div className="min-w-0">
              <span className="text-[13px] font-semibold text-ng-ink">Account status</span>
              <p className="text-[11.5px] font-medium text-ng-ink-soft">
                {active ? "Active — can sign in." : "Deactivated — sign-in is blocked."}
              </p>
            </div>
            <Switch checked={active} onChange={setActive} label="Toggle account status" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ng-line-soft bg-ng-paper">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={handleSave} disabled={submitting}>
            <Icon name="diskette-bold" size={16} />
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
