/**
 * Admin phone allowlist — maps a VERIFIED phone number to an operator role.
 *
 * Phone OTP proves possession of a number, not authorisation. So a verified
 * number is only granted admin access if it appears in the env allowlist:
 *   ADMIN_PHONE        → "superadmin"
 *   STAFF_ADMIN_PHONE  → "admin"  (optional)
 *
 * This mirrors the email/passcode model in `/api/admin/login`: identities live
 * in env, not a database. Unknown numbers fail closed (null).
 */
import type { AdminRole } from "@/lib/admin-session";

/** Normalise to E.164-ish: keep a leading "+", strip every other non-digit. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/**
 * Resolve a verified phone number to its admin role, or null when the number is
 * not an authorised operator. Comparison is on the normalised form so
 * "+91 98765 43210" matches "+919876543210".
 */
export function roleForPhone(phone: string): AdminRole | null {
  const p = normalizePhone(phone);
  if (!p) return null;

  const superPhone = process.env.ADMIN_PHONE;
  if (superPhone && normalizePhone(superPhone) === p) return "superadmin";

  const staffPhone = process.env.STAFF_ADMIN_PHONE;
  if (staffPhone && normalizePhone(staffPhone) === p) return "admin";

  return null;
}
