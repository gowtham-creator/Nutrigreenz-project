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
/**
 * The `expiry` encoding, kept as a list because it was found by probing.
 *
 * Both PDFs type this field as a timestamp. It is a count of MINUTES, capped at
 * 30. That was established by creating one sandbox order per candidate and
 * reading which the bank accepted: epoch-seconds, duration-in-milliseconds and
 * epoch-milliseconds were each rejected with error 2104, and the bare number 25
 * was accepted. Every rejected value exceeds 30 when read as minutes.
 *
 * The list survives so the same probe can be re-run against the live gateway,
 * or if SBI changes the contract, without rebuilding the harness.
 */
const EXPIRY_ENCODINGS: { mode: string; explain: string; value?: number }[] = [
  { mode: "expiry = 25", explain: "minutes — the encoding the bank accepts", value: 25 },
];

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

  const { createSbiepayOrder } = await import("@/lib/sbiepay-client");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://nutrigreenz.farm";

  const attempts: {
    mode: string;
    explain: string;
    ok: boolean;
    orderRefNumber?: string;
    transactionUrl?: string;
    error?: string;
  }[] = [];

  for (const encoding of EXPIRY_ENCODINGS) {
    /*
     * A fresh reference per attempt. Reusing one would draw error 2209 ("the
     * previous transaction was already completed") on the second try and hide
     * whichever encoding actually works.
     *
     * The prefix makes these obviously tests, so one appearing in a
     * reconciliation report identifies itself without anyone looking it up.
     */
    const orderRefNumber = `NGT${encoding.mode.slice(0, 3).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

    try {
      const created = await createSbiepayOrder({
        orderAmount: 1,
        currencyCode: "INR",
        orderRefNumber,
        returnUrl: `${site}/api/payments/sbiepay/callback`,
        ...(encoding.value === undefined ? {} : { expiry: encoding.value }),
      });
      attempts.push({
        mode: encoding.mode,
        explain: encoding.explain,
        ok: true,
        orderRefNumber,
        transactionUrl: created.transactionUrl,
      });
    } catch (err) {
      attempts.push({
        mode: encoding.mode,
        explain: encoding.explain,
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return Response.json({
    ok: attempts.some((a) => a.ok),
    environment: sbiepayEnv(),
    attempts,
    next: "Open each working link. The one that loads a real payment page — not a 404 — is the encoding to use.",
  });
}
