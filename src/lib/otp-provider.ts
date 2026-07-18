/**
 * Phone-OTP provider selector — the single feature flag that switches how phone
 * one-time codes are DELIVERED, on BOTH the client and the server.
 *
 *   `NEXT_PUBLIC_OTP_PROVIDER`
 *     · unset / "firebase"  (DEFAULT) → Firebase phone auth (reCAPTCHA + ID token)
 *     · "msg91"                       → MSG91 v5 SMS OTP (server send/verify)
 *
 * Because the var is `NEXT_PUBLIC_*`, Next inlines it into the client bundle at
 * build time and the browser can read it straight from `process.env`, while the
 * server reads it per request. Anything other than the EXACT string "msg91"
 * resolves to Firebase, so a typo can never silently disable the default path.
 *
 * This module has NO `server-only` marker and imports nothing runtime-specific,
 * so it is safe to import from client components, route handlers and the Edge
 * proxy alike. There is no build-time dependency on MSG91 here.
 */
export type OtpProvider = "firebase" | "msg91";

/** Resolve the active phone-OTP provider (defaults to Firebase). */
export function otpProvider(): OtpProvider {
  return process.env.NEXT_PUBLIC_OTP_PROVIDER === "msg91" ? "msg91" : "firebase";
}

/** True only when the MSG91 SMS-OTP path is selected. */
export function isMsg91Otp(): boolean {
  return otpProvider() === "msg91";
}
