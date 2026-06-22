/**
 * Server-only Supabase client (service-role). Used to read/write application
 * tables (e.g. `public.users`) from Node route handlers. The service-role key
 * bypasses Row-Level Security, so this module MUST NEVER be imported into a
 * client component or the Edge proxy — keep it server-side only.
 *
 * Fails closed: when the Supabase env vars are absent, `isSupabaseConfigured`
 * is false and `supabaseAdmin()` throws rather than creating a broken client.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the server-side Supabase credentials are present. */
export const isSupabaseConfigured = Boolean(url && serviceRoleKey);

let client: SupabaseClient | null = null;

/**
 * Lazily create the singleton service-role client, or throw if unconfigured.
 * No session persistence/refresh — this is a stateless server client.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
