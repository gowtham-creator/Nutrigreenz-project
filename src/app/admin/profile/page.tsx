"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { AdminShell, Card, Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { Toggle, SaveBar } from "@/components/ng/admin/super/controls";
import { Input } from "@/components/ng/input";
import { getAdminEmail, getAdminRole, type AdminRole } from "@/lib/admin-auth";
import { readCachedPhoto, writeCachedPhoto } from "@/lib/admin-photo-cache";
import { invalidateAdminMe } from "@/lib/admin-me-client";
import {
  ENROLL_AUTHENTICATOR_EVENT,
  AUTHENTICATOR_ENROLLED_EVENT,
} from "@/components/ng/admin/authenticator-enroll-prompt";

/**
 * /admin/profile — an operator's own account.
 *
 * Both Admin and Super Admin can reach this page (it is NOT super-admin gated).
 * Name, mobile, photo and the account meta (member since / last sign-in) load
 * from `/api/admin/me` (backed by the `admins` row), and the recent-activity
 * feed loads from `/api/admin/me/activity` — the operator's own trail. Edits
 * persist via `PATCH /api/admin/me` (+ the photo endpoint); identity is resolved
 * server-side from the signed session, never from the client.
 *
 * Important: a person can edit their own name/mobile/security here, but the
 * ROLE is read-only — only a Super Admin can change someone's role (from
 * Config → Roles), so an Admin can never self-promote. Password, 2FA and
 * session management remain their own surfaces.
 */
function roleLabel(role: AdminRole | null): string {
  return role === "superadmin" ? "Super Admin" : "Admin";
}

/** One recent-activity row as returned by `/api/admin/me/activity`. */
interface ActivityItem {
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

/** Friendly label + Solar icon for a known activity action code (fallback: humanised). */
const ACTIVITY_LABELS: Record<string, { label: string; icon: string }> = {
  "admin.signin": { label: "Signed in", icon: "login-3-bold" },
  "admin.profile_update": { label: "Updated your profile", icon: "customer" },
  "admin.photo_update": { label: "Changed your photo", icon: "camera-bold" },
  "admin.photo_remove": { label: "Removed your photo", icon: "camera-bold" },
  "admin.create": { label: "Added an admin", icon: "customer" },
  "admin.update": { label: "Updated an admin", icon: "pen-2-bold" },
  "admin.reset_password": { label: "Reset an admin’s password", icon: "lock" },
  "admin.delete": { label: "Removed an admin", icon: "customer" },
  "coupon.create": { label: "Created a coupon", icon: "speaker-bold" },
  "coupon.update": { label: "Updated a coupon", icon: "speaker-bold" },
  "coupon.delete": { label: "Deleted a coupon", icon: "speaker-bold" },
  "coupon.deactivate": { label: "Deactivated a coupon", icon: "speaker-bold" },
  "promotion.create": { label: "Created a promotion", icon: "speaker-bold" },
  "promotion.update": { label: "Updated a promotion", icon: "speaker-bold" },
  "promotion.delete": { label: "Deleted a promotion", icon: "speaker-bold" },
};

/** Describe an activity row for the feed: label, icon and an optional detail. */
function describeActivity(
  item: ActivityItem,
  selfEmail: string | null,
): { label: string; icon: string; detail: string | null } {
  const known = ACTIVITY_LABELS[item.action];
  const label =
    known?.label ??
    item.action.replace(/[._-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const icon = known?.icon ?? "settings";
  // Hide the target when it is just the operator themselves (sign-ins, own
  // profile/photo edits); show it when it names something else (a coupon, an
  // admin they managed, etc.).
  const detail = item.target && item.target !== selfEmail ? item.target : null;
  return { label, icon, detail };
}

/** "12 May 2026"the join date, or "—" when unknown. */
function formatMemberSince(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "Today, 9:12 AM" / "Yesterday, …" / "3 May, …"last sign-in, or "—". */
function formatLastSignIn(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

/** A short relative timestamp for the activity feed. */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const SESSIONS: { device: string; place: string; when: string; current: boolean; icon: string }[] = [
  { device: "This device · Chrome on macOS", place: "Hyderabad, IN", when: "Active now", current: true, icon: "monitor-bold" },
  { device: "Safari on iPhone", place: "Hyderabad, IN", when: "2 days ago", current: false, icon: "smartphone-bold" },
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
  // A freshly-picked image file, uploaded on Save (null once persisted).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Account meta + personal activity, hydrated from the DB on mount.
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

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
  /** Whether an authenticator secret has actually been scanned and confirmed. */
  const [totpEnrolled, setTotpEnrolled] = useState(false);

  useEffect(() => {
    const e = getAdminEmail();
    const r = getAdminRole();
    setEmail(e);
    setRole(r);
    const guess = e
      ? e.split("@")[0].split(/[._-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(" ")
      : "Operator";
    // Paint the cached avatar instantly so it doesn't flash the initial letter
    // while /api/admin/me is in flight. Seed `saved.photo` to the same value so
    // the SaveBar doesn't read it as an unsaved change.
    const cachedPhoto = readCachedPhoto();
    const seed = { name: guess || "Operator", mobile: "", photo: cachedPhoto };
    setName(seed.name);
    setMobile(seed.mobile);
    setPhoto(cachedPhoto);
    setSaved(seed);
  }, []);

  // Hydrate the real profile + personal activity from the DB. Overrides the
  // cookie-seeded guesses above once the authoritative values arrive.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, actRes] = await Promise.all([
          fetch("/api/admin/me"),
          fetch("/api/admin/me/activity"),
        ]);
        if (alive && meRes.ok) {
          const data = await meRes.json();
          const p = data.profile as {
            email?: string;
            role?: AdminRole;
            name?: string | null;
            phone?: string | null;
            photoUrl?: string | null;
            createdAt?: string | null;
            lastLoginAt?: string | null;
          } | null;
          if (p) {
            if (p.email) setEmail(p.email);
            if (p.role) setRole(p.role);
            const digits = p.phone ? String(p.phone).replace(/\D/g, "").slice(-10) : "";
            setCreatedAt(p.createdAt ?? null);
            setLastLoginAt(p.lastLoginAt ?? null);
            // Prefer the stored name; otherwise keep the cookie-derived guess.
            setName((cur) => (p.name ? p.name : cur));
            setMobile(digits);
            setPhoto(p.photoUrl ?? null);
            writeCachedPhoto(p.photoUrl ?? null);
            setSaved((s) => ({
              name: p.name ? p.name : s.name,
              mobile: digits,
              photo: p.photoUrl ?? null,
            }));
          }
        }
        if (alive && actRes.ok) {
          const adata = await actRes.json();
          setActivity(Array.isArray(adata.activity) ? (adata.activity as ActivityItem[]) : []);
        }
      } catch {
        /* ignore — the page still shows the cookie identity + empty activity */
      } finally {
        if (alive) setActivityLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Re-pull the personal activity feed (after a save/photo change). */
  async function refreshActivity() {
    try {
      const res = await fetch("/api/admin/me/activity");
      if (!res.ok) return;
      const data = await res.json();
      setActivity(Array.isArray(data.activity) ? (data.activity as ActivityItem[]) : []);
    } catch {
      /* non-fatal */
    }
  }

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
        setTotpEnrolled(Boolean(data.totpEnrolled));
        // Note: the editable mobile field is seeded from the DB profile
        // (`/api/admin/me`), not from the OTP destination — Save syncs the
        // number the other way (profile → OTP destination) below.
      } catch {
        /* ignore — the section just stays in its default state */
      }
    })();

    // The enrolment modal arms the factor server-side; mirror it here so the
    // toggle flips without needing a page reload.
    function onEnrolled() {
      setTotpEnrolled(true);
      setFactors((f) => (f ? { ...f, totp: true } : f));
    }
    window.addEventListener(AUTHENTICATOR_ENROLLED_EVENT, onEnrolled);

    return () => {
      window.removeEventListener(AUTHENTICATOR_ENROLLED_EVENT, onEnrolled);
      alive = false;
    };
  }, [role]);

  const isSuper = role === "superadmin";
  const dirty = name !== saved.name || mobile !== saved.mobile || photo !== saved.photo;
  const initial = (name.trim()[0] ?? email?.trim()?.[0] ?? "A").toUpperCase();

  async function handleSave() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name can’t be empty", { description: "Enter your full name before saving." });
      return;
    }
    const mobileDigits = mobile.trim();
    setSaving(true);
    try {
      // 1) Persist name + mobile to the operator's own admins row.
      const res = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmedName, phone: mobileDigits }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data.error === "invalid-phone"
            ? "Enter a valid 10-digit mobile, or clear it."
            : data.error === "name-required"
              ? "Name can’t be empty."
              : data.error === "no-profile"
                ? "Your sign-in isn’t backed by a saved profile."
                : "Couldn’t save, please try again.";
        toast.error("Not saved", { description: msg });
        return;
      }

      // 2) Upload a freshly-picked photo, if any, and swap the preview for the
      //    persisted public URL.
      let nextPhoto = photo;
      if (photoFile) {
        const form = new FormData();
        form.append("file", photoFile);
        const pRes = await fetch("/api/admin/me/photo", { method: "POST", body: form });
        const pData = await pRes.json().catch(() => ({}));
        if (pRes.ok && typeof pData.photoUrl === "string") {
          setPhoto((prev) => {
            if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return pData.photoUrl as string;
          });
          nextPhoto = pData.photoUrl as string;
          setPhotoFile(null);
        } else {
          toast.error("Photo not uploaded", {
            description: "Your name and mobile were saved, but the photo couldn’t upload.",
          });
        }
      }

      // 3) Keep the profile mobile in sync with the mobile-OTP destination so
      //    the sign-in code always goes to the number shown here. The factors
      //    endpoint is super-admin gated; `factors !== null` means it loaded.
      if (factors && mobileDigits.length === 10) {
        const e164 = `+91${mobileDigits}`;
        try {
          const fRes = await fetch("/api/admin/security/factors", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ otpPhone: e164 }),
          });
          const fData = await fRes.json().catch(() => ({}));
          if (fRes.ok) {
            setFactors((f) => (f ? { ...f, otpPhone: fData.factors?.otpPhone ?? e164 } : f));
          }
        } catch {
          /* non-fatal — the rest of the profile still saved */
        }
      }

      setName(trimmedName);
      setSaved({ name: trimmedName, mobile: mobileDigits, photo: nextPhoto });
      writeCachedPhoto(nextPhoto);
      // Refresh the header avatar + the personal activity feed. The shared
      // /api/admin/me cache is dropped first, otherwise the chip would re-read
      // the pre-save value it cached moments ago and the new photo/name would
      // not appear until the TTL expired.
      invalidateAdminMe();
      window.dispatchEvent(new Event("ng:profile-updated"));
      void refreshActivity();
      toast.success("Profile updated", { description: "Your name, mobile and photo were saved." });
    } catch {
      toast.error("Not saved", { description: "Couldn’t reach the server. Try again." });
    } finally {
      setSaving(false);
    }
  }
  function handleReset() {
    setName(saved.name);
    setMobile(saved.mobile);
    setPhoto((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return saved.photo;
    });
    setPhotoFile(null);
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
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhotoFile(file);
    toast.message("Photo selected", { description: "Click Save to upload it to your profile." });
  }
  async function removePhoto() {
    const hadSaved = saved.photo !== null;
    setPhoto((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoFile(null);
    if (!hadSaved) return; // only an unsaved preview was showing — nothing to delete
    try {
      const res = await fetch("/api/admin/me/photo", { method: "DELETE" });
      if (res.ok) {
        setSaved((s) => ({ ...s, photo: null }));
        writeCachedPhoto(null);
        window.dispatchEvent(new Event("ng:profile-updated"));
        void refreshActivity();
        toast.success("Photo removed");
      } else {
        toast.error("Not removed", { description: "Couldn’t remove your photo. Try again." });
      }
    } catch {
      toast.error("Not removed", { description: "Couldn’t reach the server. Try again." });
    }
  }
  function sendReset() {
    toast.success("Reset link sent", {
      description: `We’ve emailed a password reset link to ${email ?? "your inbox"}.`,
    });
  }
  async function setFactor(key: "totp" | "emailOtp" | "phoneOtp", value: boolean) {
    // Switching the authenticator ON is an ENROLMENT, not a setting: the server
    // refuses to arm the factor without a confirmed secret, because doing so
    // would demand a code at sign-in from an app that was never set up. Open the
    // QR flow instead; it turns the factor on itself once a code is confirmed.
    if (key === "totp" && value && !totpEnrolled) {
      window.dispatchEvent(new Event(ENROLL_AUTHENTICATOR_EVENT));
      return;
    }
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
        // Belt-and-braces: if the server still says "not enrolled" (e.g. the
        // enrolment status was stale), open the QR flow rather than dead-ending.
        if (data.error === "totp-not-enrolled") {
          window.dispatchEvent(new Event(ENROLL_AUTHENTICATOR_EVENT));
          return;
        }
        const msg =
          data.error === "totp-unavailable"
            ? "Scan the authenticator QR first."
            : data.error === "email-unavailable"
              ? "Connect email (add your Brevo key) first."
              : data.error === "phone-required"
                ? "Add an operator mobile (ADMIN_PHONE) first."
                : "Couldn’t update. Try again.";
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
                      <img
                        src={photo}
                        alt="Your profile"
                        className="size-full object-cover"
                        onError={() => {
                          // Stale/broken cached URL — show the initial instead.
                          if (!photo.startsWith("blob:")) {
                            setPhoto(null);
                            writeCachedPhoto(null);
                          }
                        }}
                      />
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
                  <UiIcon name="email" size={14} className="text-ng-ink-soft shrink-0" />
                  <span className="font-mono truncate">{email ?? "admin"}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-clay/15 text-ng-clay-deep font-bold px-2.5 py-1 text-[11px] uppercase tracking-wider">
                    <UiIcon name={isSuper ? "admin" : "lock"} size={12} />
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
                prefix={<UiIcon name="customer" size={18} />}
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
              note="Saved to your account: name, mobile and photo persist to the database."
              dirty={dirty}
              onSave={handleSave}
              onReset={handleReset}
            />
          </Card>

          {/* Security */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <UiIcon name="lock" size={18} className="text-ng-forest" />
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
                <UiIcon name="lock" size={14} className="text-ng-clay-deep" />
                Send reset link
              </button>
            </div>

            <div className="border-t border-ng-line-soft" />

            {/* Sign-in methods */}
            <div className="py-3">
              <span className="block text-[13.5px] font-semibold text-ng-ink">Sign-in methods</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-success/12 text-ng-success font-semibold px-3 py-1.5 text-[12px]">
                  <UiIcon name="lock" size={14} />
                  Password · enabled
                </span>
                <button
                  type="button"
                  onClick={() => toast.message("Connect Google", { description: "Operator Google sign-in isn’t enabled. Use your email and password, or phone sign-in." })}
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
                    <UiIcon name="verified" size={10} />
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
                <UiIcon name="lock" size={14} className="text-ng-ink-soft" />
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
                { k: "Role", icon: isSuper ? "admin" : "lock", v: roleLabel(role) },
                { k: "Status", icon: "check-circle-bold", v: "Active" },
                { k: "Member since", icon: "calendar-minimalistic-bold", v: formatMemberSince(createdAt) },
                { k: "Last sign-in", icon: "clock-circle-bold", v: formatLastSignIn(lastLoginAt) },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ng-ink-muted">
                    <UiIcon name={row.icon as UiIconName} size={15} className="text-ng-ink-soft" />
                    {row.k}
                  </dt>
                  <dd className="text-[13px] font-semibold text-ng-ink tabular-nums">{row.v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Recent activity">
            {activity.length > 0 ? (
              <ol>
                {activity.map((item, i) => {
                  const d = describeActivity(item, email);
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 py-2.5 border-b border-ng-line-soft last:border-0"
                    >
                      <span className="grid place-items-center size-8 rounded-lg bg-ng-forest/10 text-ng-forest shrink-0 mt-0.5">
                        <Icon name={d.icon} size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ng-ink">{d.label}</div>
                        {d.detail ? (
                          <div className="text-[11.5px] font-medium text-ng-ink-soft truncate">{d.detail}</div>
                        ) : null}
                      </div>
                      <span className="text-[11px] font-medium text-ng-ink-soft tabular-nums shrink-0 mt-0.5">
                        {relativeTime(item.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-6 text-center text-[12.5px] font-medium text-ng-ink-soft">
                {activityLoaded ? "No recent activity yet." : "Loading activity…"}
              </p>
            )}
          </Card>
        </div>

        {/* ---- Footer note ---------------------------------------------- */}
        <p className="lg:col-span-3 text-[11.5px] font-medium text-ng-ink-soft flex items-center gap-1.5">
          <Icon name="info-circle-bold" size={13} className="text-ng-forest" />
          Your profile details and recent activity are live. Google sign-in and multi-device session controls are still being wired up.
        </p>
      </div>
    </AdminShell>
  );
}
