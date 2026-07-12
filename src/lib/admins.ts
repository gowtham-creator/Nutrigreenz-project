/**
 * DB-backed admin accounts (Supabase `public.admins`). Lets the super-admin
 * add/manage operators at runtime instead of hard-coding them in env vars.
 * Service-role only — import from Node route handlers, never client/Edge.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword, verifyPassword } from "@/lib/password";
import { normalizePhone } from "@/lib/admin-allowlist";

export type AdminRole = "admin" | "superadmin";
export type AdminStatus = "active" | "invited" | "disabled";

export interface AdminRecord {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: AdminRole;
  status: AdminStatus;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  photo_url: string | null;
  role: AdminRole;
  status: AdminStatus;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

const COLS =
  "id, email, name, phone, photo_url, role, status, must_change_password, created_at, last_login_at";

const norm = (email: string) => email.trim().toLowerCase();

function toRecord(r: AdminRow): AdminRecord {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    photoUrl: r.photo_url,
    role: r.role,
    status: r.status,
    mustChangePassword: r.must_change_password,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

/** All admins, oldest first. */
export async function listAdmins(): Promise<AdminRecord[]> {
  const { data } = await supabaseAdmin()
    .from("admins")
    .select(COLS)
    .order("created_at", { ascending: true });
  return ((data as AdminRow[] | null) ?? []).map(toRecord);
}

export async function adminEmailExists(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("admins")
    .select("id")
    .eq("email", norm(email))
    .maybeSingle();
  return Boolean(data);
}

/** Whether any admin already holds the given normalised E.164 phone. */
export async function adminPhoneExists(phoneE164: string): Promise<boolean> {
  const phone = normalizePhone(phoneE164);
  if (!phone) return false;
  const { data } = await supabaseAdmin()
    .from("admins")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Whether an E.164 number is already taken — by an existing DB admin OR by the
 * env-configured super-admin / staff numbers (which sign in without a DB row).
 */
export async function phoneTaken(phoneE164: string): Promise<boolean> {
  const phone = normalizePhone(phoneE164);
  if (!phone) return false;
  const envPhones = [process.env.ADMIN_PHONE, process.env.STAFF_ADMIN_PHONE]
    .map((p) => (p ? normalizePhone(p) : ""))
    .filter(Boolean);
  if (envPhones.includes(phone)) return true;
  return adminPhoneExists(phone);
}

/** A single admin by id, or null when it doesn't exist. */
export async function getAdminById(id: string): Promise<AdminRecord | null> {
  const { data } = await supabaseAdmin()
    .from("admins")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  return data ? toRecord(data as AdminRow) : null;
}

/**
 * A single admin by email (case-insensitive), or null when there is no DB row
 * (e.g. an env-configured operator that signs in without an `admins` record).
 *
 * READ helper for the operator's own profile — deliberately swallows any error
 * and returns null so a DB hiccup degrades the profile page gracefully instead
 * of throwing into the route handler.
 */
export async function getAdminByEmail(email: string): Promise<AdminRecord | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("admins")
      .select(COLS)
      .eq("email", norm(email))
      .maybeSingle();
    return data ? toRecord(data as AdminRow) : null;
  } catch {
    return null;
  }
}

/** Editable subset of an operator's OWN profile (resolved server-side by email
 *  from the signed session — never a client-supplied id). */
export interface AdminProfileUpdate {
  email: string;
  name?: string;
  phone?: string | null;
  photoUrl?: string | null;
}

/**
 * Persist the signed-in operator's own profile fields, keyed by their session
 * email. Only the provided keys are written; `updated_at` is bumped so the row
 * reflects the edit. Returns the fresh record, or null when no `admins` row
 * matched (an env-only operator with nothing to persist). Service-role only.
 */
export async function updateAdminProfile(
  input: AdminProfileUpdate,
): Promise<AdminRecord | null> {
  const patch: Record<string, string | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim() || null;
  if (input.phone !== undefined) patch.phone = (input.phone ?? "").trim() || null;
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl || null;
  if (Object.keys(patch).length === 0) return getAdminByEmail(input.email);

  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .update(patch)
    .eq("email", norm(input.email))
    .select(COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecord(data as AdminRow) : null;
}

/** Generate a readable, strong password (no ambiguous characters). */
export function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

export interface NewAdminInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: AdminRole;
}

/** Create an admin (defaults to role `admin`, must change password on first login). */
export async function createAdmin(input: NewAdminInput): Promise<AdminRecord> {
  const passcode_hash = await hashPassword(input.password);
  const { data, error } = await supabaseAdmin()
    .from("admins")
    .insert({
      email: norm(input.email),
      name: input.name.trim() || null,
      phone: input.phone.trim() || null,
      role: input.role ?? "admin",
      passcode_hash,
      status: "active",
      must_change_password: true,
    })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create admin.");
  return toRecord(data as AdminRow);
}

/** Verify a DB admin's email + password; bumps last_login_at and returns the record, or null. */
export async function verifyAdminLogin(
  email: string,
  password: string,
): Promise<AdminRecord | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("admins")
    .select(`${COLS}, passcode_hash`)
    .eq("email", norm(email))
    .maybeSingle();
  if (!data) return null;
  const row = data as AdminRow & { passcode_hash: string | null };
  if (row.status === "disabled" || !row.passcode_hash) return null;
  if (!(await verifyPassword(password, row.passcode_hash))) return null;
  await db.from("admins").update({ last_login_at: new Date().toISOString() }).eq("id", row.id);
  return toRecord(row);
}

export async function setAdminStatus(email: string, status: AdminStatus): Promise<void> {
  await supabaseAdmin().from("admins").update({ status }).eq("email", norm(email));
}

export async function deleteAdmin(email: string): Promise<void> {
  await supabaseAdmin().from("admins").delete().eq("email", norm(email));
}

/** Set an admin's status by id. */
export async function setAdminStatusById(id: string, status: AdminStatus): Promise<void> {
  await supabaseAdmin().from("admins").update({ status }).eq("id", id);
}

/** Delete an admin by id. */
export async function deleteAdminById(id: string): Promise<void> {
  await supabaseAdmin().from("admins").delete().eq("id", id);
}

export interface AdminUpdateInput {
  name?: string;
  phone?: string;
  role?: AdminRole;
  status?: AdminStatus;
}

/** Apply an editable subset of fields to an admin and return the fresh record. */
export async function updateAdmin(id: string, input: AdminUpdateInput): Promise<AdminRecord | null> {
  const patch: Record<string, string | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.role !== undefined) patch.role = input.role;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return getAdminById(id);

  const { data, error } = await supabaseAdmin()
    .from("admins")
    .update(patch)
    .eq("id", id)
    .select(COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRecord(data as AdminRow) : null;
}

/**
 * Generate a new strong password for an admin, store its hash, and clear the
 * must-change flag. Returns the plaintext ONCE so it can be revealed/copied;
 * it is never persisted in clear and can't be retrieved again.
 */
export async function resetAdminPassword(id: string): Promise<string | null> {
  const password = generatePassword();
  const passcode_hash = await hashPassword(password);
  const { data } = await supabaseAdmin()
    .from("admins")
    .update({ passcode_hash, must_change_password: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  return data ? password : null;
}
