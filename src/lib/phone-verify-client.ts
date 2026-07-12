"use client";

/**
 * Client bridge for the inline phone-verification handshake used by welcome /
 * first-order coupons.
 *
 * A welcome coupon only validates once the canonical customer owns an
 * OTP-verified phone. When the checkout coupon field hits a
 * `phone-verification-required` rejection it broadcasts
 * {@link PHONE_VERIFY_REQUEST_EVENT}; the globally-mounted `<LinkPhonePrompt>`
 * listens and opens its OTP flow. After a successful verify the prompt broadcasts
 * {@link PHONE_VERIFIED_EVENT}, which the coupon field listens for to
 * automatically re-validate and apply the code — no re-typing required.
 *
 * Mirrors the pattern in `@/lib/google-enrich-client`. Purely presentational glue
 * over `window` CustomEvents: SSR-safe (no-ops without a `window`) and decoupled,
 * so neither component needs a direct reference to the other. This never gates a
 * normal (non-welcome) coupon or a plain order.
 */

/** Ask the mounted OTP prompt to open so the customer can verify their phone. */
export const PHONE_VERIFY_REQUEST_EVENT = "ng:phone-verify-request";
/** Fired by the OTP prompt after a phone was successfully verified + linked. */
export const PHONE_VERIFIED_EVENT = "ng:phone-verified";

/** Broadcast a request to open the inline phone-verification (OTP) prompt. */
export function requestPhoneVerification(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PHONE_VERIFY_REQUEST_EVENT));
}

/** Announce that a phone was just verified + linked to the canonical customer. */
export function announcePhoneVerified(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PHONE_VERIFIED_EVENT));
}
