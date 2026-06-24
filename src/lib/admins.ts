/**
 * DB-backed admin accounts (Supabase `public.admins`). Lets the super-admin
 * add/manage operators at runtime instead of hard-coding them in env vars.
 * Service-role only — import from Node route handlers, never client/Edge.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword, verifyPassword } from "@/lib/password";

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
