import { sendOtp, isMsg91OtpConfigured, normalizeMsg91Mobile } from "@/lib/msg91-otp";
import { checkOtpSendLimit } from "@/lib/otp-rate-limit";

// Uses fetch to MSG91 from the server; keep on the Node runtime.
export const runtime = "nodejs";

/**
 * POST /api/auth/otp/send  { phone }
 *
 * Generic MSG91 SMS-OTP sender used by the storefront, captain and admin
 * (primary phone) sign-in surfaces when `NEXT_PUBLIC_OTP_PROVIDER=msg91`. MSG91
 * generates + stores the code on its side — we store NOTHING. Rate-limited per
 * number (max 5 / 15 min). Never crashes: when SMS OTP isn't configured it
 * returns a clear 503.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isMsg91OtpConfigured()) {
    return Response.json({ ok: false, error: "SMS OTP not configured" }, { status: 503 });
  }

  let phone: unknown;
  try {
    phone = (await request.json())?.phone;
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (typeof phone !== "string") {
    return Response.json({ ok: false, error: "missing_phone" }, { status: 400 });
  }

  const mobile = normalizeMsg91Mobile(phone);
  if (!mobile) {
    return Response.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }

  // Anti-abuse: cap sends per number before spending an SMS.
  const limit = checkOtpSendLimit(mobile);
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const result = await sendOtp(phone);
  if (!result.ok) {
    if (result.error === "not_configured") {
      return Response.json({ ok: false, error: "SMS OTP not configured" }, { status: 503 });
    }
    return Response.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
