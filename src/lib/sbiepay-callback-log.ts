import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { sbiepayEncryptionKey } from "@/lib/payments";
import { decodeCallbackPayload } from "@/lib/sbiepay-crypto";

/**
 * Record what actually arrived at the SBIePay return URL.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * SBI's merchant support asks for "the final encrypted and decrypted responses
 * received at your return URL". We could produce neither. The callback read the
 * POST as plain form fields, and `decodeCallbackPayload` — which has been sitting
 * in sbiepay-crypto.ts the whole time — was never called from anywhere. Their
 * ciphertext arrived, was treated as an ordinary string field, and was thrown
 * away unread.
 *
 * ── What it must never do ─────────────────────────────────────────────────
 *
 * Decide anything. An order is marked paid because the Order Search API returns
 * `orderStatus: PAID` and the captured amount matches — that is unchanged. This
 * is a diagnostic record kept beside that decision, which is also why every
 * failure here is swallowed: a logging problem must never cost a customer a
 * payment that the bank has already taken.
 */

/** One recorded callback, newest first when listed. */
export interface CallbackLogRow {
  id: string;
  receivedAt: string;
  method: string;
  orderNumber: string | null;
  raw: Record<string, string>;
  decrypted: Record<string, unknown> | null;
  encField: string | null;
  decryptNote: string | null;
}

/**
 * Find the ciphertext and decrypt it.
 *
 * The field name is not assumed. SBI's own naming has already cost us once —
 * `orderRefNumber` was missing from the order lookup and every payment would
 * have failed to match — so rather than hardcode `encData` or `encResponse` and
 * discover the spelling in production, every plausible field is tried and the
 * one that decrypts wins. GCM's auth tag makes that safe: a field that decrypts
 * under our key was produced with our key, so a false positive is not possible.
 */
async function decrypt(
  payload: Record<string, string>,
): Promise<{ decrypted: Record<string, unknown> | null; encField: string | null; note: string | null }> {
  const key = sbiepayEncryptionKey();
  if (!key) {
    return { decrypted: null, encField: null, note: "encryption key not configured" };
  }

  /*
   * Only long values are worth trying. An order reference or a status code is
   * never a GCM envelope, and attempting each one just fills the note with
   * noise that hides the real failure.
   */
  const candidates = Object.entries(payload)
    .filter(([, v]) => typeof v === "string" && v.length >= 64)
    .sort(([, a], [, b]) => b.length - a.length);

  if (candidates.length === 0) {
    return { decrypted: null, encField: null, note: "no field long enough to be a GCM envelope" };
  }

  const tried: string[] = [];
  for (const [field, value] of candidates) {
    try {
      const plain = await decodeCallbackPayload(key, value);
      return { decrypted: plain, encField: field, note: null };
    } catch {
      tried.push(field);
    }
  }
  // Names only. The key itself never reaches this string, or the database.
  return {
    decrypted: null,
    encField: null,
    note: `no field decrypted under the configured key (tried: ${tried.join(", ")})`,
  };
}

/**
 * Persist one callback. Fire-and-forget: never throws, never blocks the redirect.
 */
export async function recordCallback(input: {
  method: string;
  orderNumber: string | null;
  payload: Record<string, string>;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { decrypted, encField, note } = await decrypt(input.payload);
    await supabaseAdmin().from("sbiepay_callback_log").insert({
      method: input.method,
      order_number: input.orderNumber,
      raw: input.payload,
      decrypted,
      enc_field: encField,
      decrypt_note: note,
    });
  } catch (err) {
    // Swallowed on purpose — see the header. Surfaced in the log so a silent
    // failure to record is still visible to whoever goes looking.
    console.warn(
      "[sbiepay-callback-log] could not record callback:",
      err instanceof Error ? err.message : "unknown",
    );
  }
}

/** Most recent callbacks, for the admin payment panel. */
export async function listCallbacks(limit = 10): Promise<CallbackLogRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabaseAdmin()
    .from("sbiepay_callback_log")
    .select("id, received_at, method, order_number, raw, decrypted, enc_field, decrypt_note")
    .order("received_at", { ascending: false })
    .limit(limit);

  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r.id),
    receivedAt: String(r.received_at),
    method: String(r.method),
    orderNumber: (r.order_number as string | null) ?? null,
    raw: (r.raw as Record<string, string>) ?? {},
    decrypted: (r.decrypted as Record<string, unknown> | null) ?? null,
    encField: (r.enc_field as string | null) ?? null,
    decryptNote: (r.decrypt_note as string | null) ?? null,
  }));
}
