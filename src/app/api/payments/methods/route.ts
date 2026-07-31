import { availableMethods, isOnlinePaymentAvailable } from "@/lib/payments";

// Reads process.env for the gateway credentials — Node runtime.
export const runtime = "nodejs";
// Never cached: flipping the provider on must take effect immediately, not
// after a stale edge entry expires.
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/methods — which payment methods the checkout may offer.
 *
 * Public and deliberately minimal: it returns the method list and nothing else.
 * The decision has to come from the server because it depends on whether the
 * gateway credentials are actually present, and those must never reach the
 * browser. Returning only `["cod"]` is the honest answer while SBIePay is
 * unconfigured, and it is what stops the checkout offering a UPI button that
 * would fail at the redirect.
 */
export async function GET(): Promise<Response> {
  return Response.json(
    { ok: true, methods: availableMethods(), online: isOnlinePaymentAvailable() },
    { headers: { "cache-control": "no-store" } },
  );
}
