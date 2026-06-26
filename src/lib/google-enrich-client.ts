"use client";

/**
 * Client glue for the Google People-API enrichment (Task T6, Decision C).
 *
 * After a Google sign-in, the auth provider captures the Google OAuth ACCESS
 * token and calls {@link runGoogleEnrich}, which POSTs it to
 * `/api/auth/google-enrich`. The server best-effort auto-imports the account's
 * addresses and resolves the phone (takeover-safe). This module then broadcasts a
 * single browser CustomEvent so the already-mounted listeners react:
 *   - `<AddressProvider>` refreshes the address book when addresses were imported,
 *   - `<LinkPhonePrompt>` opens PRE-FILLED for OTP when a colliding phone needs
 *     the takeover-safe verification.
 *
 * Best-effort + skippable by contract: every failure is swallowed so sign-in is
 * never blocked, and a no-op enrichment dispatches nothing.
 */

export const GOOGLE_ENRICH_EVENT = "ng:google-enrich";

/** Detail carried by the {@link GOOGLE_ENRICH_EVENT} CustomEvent. */
export interface GoogleEnrichDetail {
  /** Number of Google addresses auto-imported in this pass. */
  addressesAdded: number;
  /** A colliding E.164 phone that needs the takeover-safe OTP step, if any. */
  prefillPhone?: string;
}

interface EnrichResponse {
  ok?: boolean;
  enriched?: boolean;
  addressesAdded?: number;
  prefillPhone?: string;
}

/**
 * POST the Google access token to the enrich endpoint, then broadcast the result.
 * Resolves silently on ANY error — enrichment is additive and must never break
 * the established Google session. A null/blank token is a graceful no-op.
 */
export async function runGoogleEnrich(accessToken: string | null | undefined): Promise<void> {
  if (typeof window === "undefined") return;
  if (!accessToken) return;
  try {
    const res = await fetch("/api/auth/google-enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as EnrichResponse;
    if (!data.enriched) return;

    const detail: GoogleEnrichDetail = {
      addressesAdded: data.addressesAdded ?? 0,
      ...(data.prefillPhone ? { prefillPhone: data.prefillPhone } : {}),
    };
    // Only broadcast when there's something to react to.
    if (detail.addressesAdded > 0 || detail.prefillPhone) {
      window.dispatchEvent(
        new CustomEvent<GoogleEnrichDetail>(GOOGLE_ENRICH_EVENT, { detail }),
      );
    }
  } catch {
    /* best-effort — never block sign-in */
  }
}
