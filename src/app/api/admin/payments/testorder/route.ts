import { requireApiPermission } from "@/lib/admin-api-guard";
import { isLiveGateway, sbiepayEnv, missingSbiepayConfig } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments/testorder — create a ₹1 order on the UAT gateway.
 *
 * Exists to answer one question that cannot be answered from the documentation:
 * what the hosted payment page actually offers on this merchant's integration
 * profile — which pay modes are enabled, and whether it presents a simulator or
 * asks for a real instrument. Opening the page is the only way to see it.
 *
 * Deliberately does NOT create an order in our database. A test order in the
 * orders table would show up in revenue figures, stock movements and the
 * invoice sequence, and every one of those would then need unpicking. This
 * touches SBI's sandbox only; nothing on our side records it.
 *
 * ── Why this refuses to run against LIVE ──────────────────────────────────
 *
 * On the live gateway this would be a real ₹1 charge against a real merchant
 * account, and a diagnostic that can move money is one somebody eventually runs
 * by accident. The guard is not a formality.
 */
export async function GET(): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;

  if (isLiveGateway()) {
    return Response.json(
      {
        ok: false,
        error: "Refusing to create a test order against LIVE. Set SBIEPAY_ENV=integration.",
      },
      { status: 400 },
    );
  }

  const missing = missingSbiepayConfig();
  if (missing.length > 0) {
    return Response.json({ ok: false, error: missing.join("; ") }, { status: 400 });
  }

  try {
    const { createSbiepayOrder } = await import("@/lib/sbiepay-client");

    /*
     * A reference that is obviously a test and cannot collide with a real order
     * number, so if one ever appears in a reconciliation report it identifies
     * itself without anyone having to look it up.
     */
    const orderRefNumber = `NGTEST${Date.now().toString(36).toUpperCase()}`;

    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://nutrigreenz.farm";

    const created = await createSbiepayOrder({
      orderAmount: 1,
      currencyCode: "INR",
      orderRefNumber,
      returnUrl: `${site}/api/payments/sbiepay/callback`,
      expiry: Date.now() + 30 * 60_000,
    });

    return Response.json({
      ok: true,
      environment: sbiepayEnv(),
      orderRefNumber,
      sbiOrderRefNumber: created.sbiOrderRefNumber,
      status: created.status,
      /** Open this in a browser — it is the hosted payment page. */
      transactionUrl: created.transactionUrl,
      next: "Open transactionUrl in a browser to see which pay modes this merchant profile offers.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const code = (err as { code?: string })?.code ?? "";
    return Response.json({ ok: false, error: message, code }, { status: 502 });
  }
}
