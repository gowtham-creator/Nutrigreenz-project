import "server-only";
import { msg91AuthKey } from "@/lib/msg91";

/**
 * MSG91 v5 SMS-OTP client (SERVER-ONLY).
 *
 * With MSG91's OTP product, MSG91 GENERATES, STORES and VERIFIES the code on
 * their side — we never see, persist or compare the code ourselves. We only:
 *   · POST   /api/v5/otp          → ask MSG91 to text a code to a number
 *   · GET    /api/v5/otp/verify   → ask MSG91 whether a submitted code is valid
 *   · GET    /api/v5/otp/retry    → ask MSG91 to resend
 * The account auth key comes from {@link msg91AuthKey} (reused, read lazily) and
 * the DLT-approved template id from `MSG91_OTP_TEMPLATE_ID`. When EITHER is
 * missing every call returns `{ ok: false, error: "not_configured" }` so callers
 * can surface a clean 503 instead of crashing.
 *
 * Security: the OTP code and the auth key are NEVER logged. All calls are
 * `no-store`. Numbers are normalised to MSG91's `91` + 10-digit form.
 */

const OTP_BASE = "https://control.msg91.com/api/v5/otp";
/** Digits in the generated OTP (kept in sync with the 6-box client inputs). */
const OTP_LENGTH = 6;

/** Typed result — never leaks the code or provider internals. */
export type OtpResult = { ok: true } | { ok: false; error: string };

interface Msg91Config {
  authkey: string;
  templateId: string;
}

/** Resolve the auth key + template id, or null when either is unset. */
function readConfig(): Msg91Config | null {
  const authkey = msg91AuthKey();
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authkey || !templateId) return null;
  return { authkey, templateId };
}

/** True when both the auth key and the OTP template id are configured. */
export function isMsg91OtpConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Normalise any India-first input (E.164, 10-digit, `0`-prefixed, `91…`) to
 * MSG91's required `91` + 10-digit form. Returns null when it can't be trusted
 * as a valid Indian mobile rather than guessing.
 */
export function normalizeMsg91Mobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return null;
}

/** MSG91 replies with `{ type: "success" | "error", message }`. Narrow it safely. */
function readEnvelope(value: unknown): { type: string; message: string } {
  if (typeof value === "object" && value !== null) {
    const rec = value as Record<string, unknown>;
    return {
      type: typeof rec.type === "string" ? rec.type : "",
      message: typeof rec.message === "string" ? rec.message : "",
    };
  }
  return { type: "", message: "" };
}

async function parseEnvelope(res: Response): Promise<{ type: string; message: string }> {
  try {
    return readEnvelope(await res.json());
  } catch {
    return { type: "", message: "" };
  }
}

/** Ask MSG91 to text a fresh OTP to `phone`. */
export async function sendOtp(phone: string): Promise<OtpResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const mobile = normalizeMsg91Mobile(phone);
  if (!mobile) return { ok: false, error: "invalid_phone" };

  const url = new URL(OTP_BASE);
  url.searchParams.set("template_id", cfg.templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp_length", String(OTP_LENGTH));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authkey: cfg.authkey, "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const env = await parseEnvelope(res);
    if (env.type === "success") return { ok: true };
    return { ok: false, error: env.message || `send_failed_${res.status}` };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

/** Ask MSG91 to verify a submitted `code` for `phone`. */
export async function verifyOtp(phone: string, code: string): Promise<OtpResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const mobile = normalizeMsg91Mobile(phone);
  if (!mobile) return { ok: false, error: "invalid_phone" };
  if (!/^\d{4,8}$/.test(code)) return { ok: false, error: "invalid_code" };

  const url = new URL(`${OTP_BASE}/verify`);
  url.searchParams.set("otp", code);
  url.searchParams.set("mobile", mobile);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { authkey: cfg.authkey },
      cache: "no-store",
    });
    const env = await parseEnvelope(res);
    if (env.type === "success") return { ok: true };
    return { ok: false, error: env.message || "verify_failed" };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

/** Ask MSG91 to resend the current OTP over text. */
export async function resendOtp(phone: string): Promise<OtpResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const mobile = normalizeMsg91Mobile(phone);
  if (!mobile) return { ok: false, error: "invalid_phone" };

  const url = new URL(`${OTP_BASE}/retry`);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("retrytype", "text");
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { authkey: cfg.authkey },
      cache: "no-store",
    });
    const env = await parseEnvelope(res);
    if (env.type === "success") return { ok: true };
    return { ok: false, error: env.message || "resend_failed" };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
