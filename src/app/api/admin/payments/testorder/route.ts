import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  isLiveGateway,
  sbiepayEnv,
  missingSbiepayConfig,
  sbiepayBaseUrl,
} from "@/lib/payments";

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

/**
 * Return URLs to try, because ours has never been registered with SBI.
 *
 * The order is created and their status API confirms it, yet their payment page
 * refuses to render it. One thing we send that they have never been told about
 * is the return URL: keys were issued and the server IP whitelisted, but no
 * merchant-site domain was ever exchanged.
 *
 * Every sample in both guides points `returnUrl` at an SBI domain of their own
 * — `https://sit.epay.sbi`. If the hosted page only renders orders whose return
 * URL is a registered domain, an unregistered one would fail exactly like this.
 *
 * Creating one order per candidate settles it without waiting on support: if
 * the order using SBI's own domain renders a payment page and ours does not,
 * the cause is domain registration and the ask to SBI becomes specific.
 */
const RETURN_URLS: { label: string; url: (site: string) => string }[] = [
  { label: "our callback", url: (site) => `${site}/api/payments/sbiepay/callback` },
  { label: "SBI's own sample domain", url: () => "https://sit.epay.sbi" },
  { label: "the integration gateway domain", url: () => "https://integration.epay.sbi" },
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
    /** Exactly what SBI returned, unmodified. */
    transactionUrl?: string;
    /** The same order's page on the gateway host, which is the one that serves /ui/. */
    sameHostUrl?: string;
    orderHash?: string;
    /** What SBI says when asked to read the order back. */
    readBack?: string;
    error?: string;
  }[] = [];

  for (const encoding of EXPIRY_ENCODINGS.flatMap((e) =>
    RETURN_URLS.map((r) => ({ ...e, mode: `returnUrl: ${r.label}`, returnUrl: r.url(site) })),
  )) {
    /*
     * A fresh reference per attempt. Reusing one would draw error 2209 ("the
     * previous transaction was already completed") on the second try and hide
     * whichever encoding actually works.
     *
     * The prefix makes these obviously tests, so one appearing in a
     * reconciliation report identifies itself without anyone looking it up.
     */
    const orderRefNumber = `NGT${encoding.mode.replace(/[^a-zA-Z]/g, "").slice(3, 6).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

    try {
      const created = await createSbiepayOrder({
        orderAmount: 1,
        currencyCode: "INR",
        orderRefNumber,
        returnUrl: encoding.returnUrl,
        ...(encoding.value === undefined ? {} : { expiry: encoding.value }),
      });
      /*
       * Offer the payment page on our own gateway host as well as the one SBI
       * named.
       *
       * Their `transactionUrl` points at integration.epay.sbi, which does not
       * serve this environment — its TLS certificate does not even cover that
       * name. Probing found the UI at `/ui/` on the same host as the API, and
       * that host's ROOT returns the branded 404 page we were landing on.
       *
       * Both are returned rather than silently rewriting the bank's response:
       * which one works is a fact about SBI's deployment, and quietly
       * overriding it would hide a change if they ever fix their side.
       */
      const base = sbiepayBaseUrl();
      const sameHostUrl =
        base && created.orderHash ? `${base}/ui/#${created.orderHash}` : undefined;

      /*
       * Ask SBI to read back the order it just gave us.
       *
       * This separates two very different failures that look identical from a
       * 404 page: an order the bank never really registered, versus an order
       * that exists but whose hosted page is not provisioned for this merchant.
       * The first is ours to fix; the second is only fixable by SBI, and
       * knowing which avoids days spent on the wrong one.
       */
      let readBack: string;
      try {
        const { searchSbiepayOrder } = await import("@/lib/sbiepay-client");
        const found = await searchSbiepayOrder({
          sbiOrderRefNumber: created.sbiOrderRefNumber,
          // Required despite the field table — see OrderSearchCriteria.
          orderAmount: 1,
        });
        const info = found[0]?.orderInfo;
        readBack = info
          ? `SBI confirms the order exists, status ${info.orderStatus}`
          : "SBI returned no order for this reference";
      } catch (err) {
        readBack = `status lookup failed: ${err instanceof Error ? err.message : "unknown"}`;
      }

      attempts.push({
        mode: encoding.mode,
        explain: encoding.explain,
        ok: true,
        orderRefNumber,
        transactionUrl: created.transactionUrl,
        sameHostUrl,
        orderHash: created.orderHash,
        readBack,
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
