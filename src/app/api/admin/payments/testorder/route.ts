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
 * The four combinations worth trying, given what the field table actually says.
 *
 * Only `currencyCode`, `orderAmount`, `orderRefNumber` and `returnUrl` are
 * mandatory, and we send all four — so nothing required is missing. That leaves
 * the optional fields, of which two could plausibly stop the hosted page from
 * rendering an order the status API confirms exists:
 *
 *   returnUrl — never registered with SBI, and every sample in both guides
 *               points it at a domain of their own
 *   payMode   — optional, but if the merchant profile carries no default
 *               channels the page has nothing to offer and may bail to /404
 *
 * Naming each one so the result reads as a finding rather than a guess.
 */
const VARIANTS: {
  label: string;
  returnUrl: (site: string) => string;
  payMode?: string;
}[] = [
  {
    // Exactly what checkout sends, now that SBI has whitelisted the domain.
    label: "our callback",
    returnUrl: (site) => `${site}/api/payments/sbiepay/callback`,
  },
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
    /**
     * The returnUrl we actually sent.
     *
     * Surfaced because SBI whitelist the merchant's source domain, and this is
     * built from NEXT_PUBLIC_SITE_URL — which on a preview deployment is a
     * vercel.app address, not the domain they were given. That mismatch is
     * invisible from our side and would look exactly like this.
     */
    sentReturnUrl?: string;
    /** SBI's own reference for the order — what their support team traces on. */
    sbiOrderRefNumber?: string;
    /**
     * Everything order/create returned, and everything we sent.
     *
     * We have been reading three fields of a fifteen-field response and
     * inferring the rest, which is how four separate theories each survived
     * longer than they should have. mId, payMode, orderRetryCount and
     * multiAccounts are all in that response and none of them have ever been
     * looked at.
     */
    raw?: { sent: unknown; received: unknown };
    /** The same order's page on the gateway host, which is the one that serves /ui/. */
    sameHostUrl?: string;
    orderHash?: string;
    /** What SBI says when asked to read the order back. */
    readBack?: string;
    error?: string;
  }[] = [];

  for (const encoding of EXPIRY_ENCODINGS.flatMap((e) =>
    VARIANTS.map((v) => ({
      ...e,
      mode: v.label,
      returnUrl: v.returnUrl(site),
      payMode: v.payMode,
    })),
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
      const payload = {
        orderAmount: 1,
        currencyCode: "INR",
        orderRefNumber,
        returnUrl: encoding.returnUrl,
        ...(encoding.payMode ? { payMode: encoding.payMode } : {}),
        ...(encoding.value === undefined ? {} : { expiry: encoding.value }),
      };
      const created = await createSbiepayOrder(payload);
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
        sentReturnUrl: encoding.returnUrl,
        sbiOrderRefNumber: created.sbiOrderRefNumber,
        raw: { sent: payload, received: created },
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
