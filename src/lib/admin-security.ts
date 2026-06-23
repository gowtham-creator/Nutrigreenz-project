/**
 * Admin sign-in security settings + email-OTP store (Supabase-backed).
 *
 * `admin_security` holds, per admin email, which second factors are enabled
 * (email OTP / phone OTP / authenticator) plus the contact each uses.
 * `admin_email_otp` holds short-lived, HASHED email codes. Service-role only —
 * import from Node route handlers, never client/Edge.
 */
import "server-only";
import { createHash, randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface AdminFactors {
  emailOtp: boolean;
  phoneOtp: boolean;
  totp: boolean;
  /** Where the email OTP is sent (defaults to the admin email). */
  otpEmail: string | null;
  /** E.164 number for the phone-OTP factor. */
  otpPhone: string | null;
}

const DEFAULT_FACTORS: AdminFactors = {
  emailOtp: false,
  phoneOtp: false,
  totp: false,
  otpEmail: null,
  otpPhone: null,
};

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/** Read an admin's saved factor settings, or all-disabled defaults. */
export async function getAdminFactors(email: string): Promise<AdminFactors> {
  const { data } = await supabaseAdmin()
    .from("admin_security")
    .select("email_otp_enabled, phone_otp_enabled, totp_enabled, otp_email, otp_phone")
    .eq("email", norm(email))
    .maybeSingle();
  if (!data) return { ...DEFAULT_FACTORS };
  return {
    emailOtp: Boolean(data.email_otp_enabled),
    phoneOtp: Boolean(data.phone_otp_enabled),
    totp: Boolean(data.totp_enabled),
    otpEmail: data.otp_email ?? null,
    otpPhone: data.otp_phone ?? null,
  };
}

/** Whether a settings row exists yet for this admin (drives back-compat). */
export async function hasSecurityRow(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("admin_security")
    .select("email")
    .eq("email", norm(email))
    .maybeSingle();
  return Boolean(data);
}

interface FactorPatch {
  emailOtp?: boolean;
  phoneOtp?: boolean;
  totp?: boolean;
  otpEmail?: string | null;
  otpPhone?: string | null;
}

/** Create or update an admin's factor settings. */
export async function setAdminFactors(email: string, patch: FactorPatch): Promise<void> {
  const row: Record<string, unknown> = { email: norm(email) };
  if (patch.emailOtp !== undefined) row.email_otp_enabled = patch.emailOtp;
  if (patch.phoneOtp !== undefined) row.phone_otp_enabled = patch.phoneOtp;
  if (patch.totp !== undefined) row.totp_enabled = patch.totp;
  if (patch.otpEmail !== undefined) row.otp_email = patch.otpEmail;
  if (patch.otpPhone !== undefined) row.otp_phone = patch.otpPhone;
  await supabaseAdmin().from("admin_security").upsert(row, { onConflict: "email" });
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Generate a 6-digit email OTP, store its hash with a 10-minute expiry (after
 * invalidating any prior unconsumed codes), and return the RAW code to send.
 */
export async function createEmailOtp(email: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = supabaseAdmin();
  const key = norm(email);
  await db.from("admin_email_otp").delete().eq("email", key).is("consumed_at", null);
  await db.from("admin_email_otp").insert({
    email: key,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  return code;
}

/**
 * Verify a submitted email OTP against the latest unconsumed, unexpired code.
 * Consumes it on success; counts attempts (max 5) otherwise.
 */
export async function verifyEmailOtp(email: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const db = supabaseAdmin();
  const { data } = await db
    .from("admin_email_otp")
    .select("id, code_hash, attempts")
    .eq("email", norm(email))
    .is("consumed_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.attempts >= 5) return false;

  if (hashCode(code) === data.code_hash) {
    await db
      .from("admin_email_otp")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.id);
    return true;
  }
  await db
    .from("admin_email_otp")
    .update({ attempts: data.attempts + 1 })
    .eq("id", data.id);
  return false;
}
