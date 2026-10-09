import { requireApiPermission } from "@/lib/admin-api-guard";
import {
  sbiepayEncryptionKey,
  sbiepayEnv,
  sbiepayKeyId,
  sbiepayKeySecret,
} from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/payments/sdk-probe — call SBIePay with SBI's OWN Node SDK.
 *
 * Our client gets a token for the merchant and then error 905 on every
 * encrypted request. Our conformance tests show our bytes equal the SDK's, but
 * only against a fake server. This runs epay_nodejs_sdk 1.2.0 itself, from the
 * production server, through the same whitelisted proxy, with the same keys:
 * if SBI's own SDK also gets 905, the cause is on the bank's side.
 *
 *   (default)       order.search for a reference that cannot exist. Creates nothing.
 *   ?action=create  order.create for ₹1. Creates a payment link at SBI that
 *                   expires in 25 minutes; no money moves unless someone pays it.
 *
 * Never returns or logs a key, the token, the proxy URL or the payment link.
 * The SDK's own logging prints the encryption key, so it stays off.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const action = params.get("action") === "create" ? "create" : "search";
  // ?expiry=none omits the field; ?expiry=<n> sends that number (default 25).
  const expiryParam = params.get("expiry");
  const expiry = expiryParam === "none" ? undefined : Number(expiryParam ?? 25);
  const env = sbiepayEnv();
  const apiKey = sbiepayKeyId();
  const apiSecret = sbiepayKeySecret();
  const encryptionKey = sbiepayEncryptionKey();
  const proxyUrl = process.env.SBIEPAY_PROXY_URL?.trim();
  const base = { sdkVersion: "1.2.0", environment: env, action };

  if (!env || !apiKey || !apiSecret || !encryptionKey) {
    return Response.json({ ok: false, ...base, outcome: "not-configured" });
  }
  // SBI only accepts the whitelisted IP; a direct call would be refused.
  if (!proxyUrl) {
    return Response.json({ ok: false, ...base, outcome: "no-proxy" });
  }

  const started = Date.now();
  const ref = `SDKPROBE${started}`;

  /*
   * ?client=ours runs order/create through OUR client (the one checkout uses),
   * which is known to authenticate on live. Used to test the payment page
   * itself: the link SBI returns, with or without expiry.
   */
  if (params.get("client") === "ours" && action === "create") {
    try {
      const { createSbiepayOrder } = await import("@/lib/sbiepay-client");
      const created = (await createSbiepayOrder({
        orderAmount: 1,
        currencyCode: "INR",
        orderRefNumber: ref,
        returnUrl: "https://nutrigreenz.farm/api/payments/sbiepay/callback",
        ...(expiry === undefined || Number.isNaN(expiry) ? {} : { expiry }),
      } as Parameters<typeof createSbiepayOrder>[0])) as unknown as Record<string, unknown>;
      console.info(`sdk-probe: client=ours action=create outcome=success expiry=${expiry ?? "omitted"}`);
      return Response.json({
        ok: true,
        ...base,
        client: "ours",
        outcome: "success",
        sentExpiry: expiry ?? "omitted",
        sbiStatus: created.status,
        sbiExpiry: created.expiry,
        sbiOrderRefNumber: created.sbiOrderRefNumber,
        transactionUrl: typeof created.transactionUrl === "string" ? created.transactionUrl : undefined,
        elapsedMs: Date.now() - started,
      });
    } catch (err) {
      const e = err as { code?: unknown; message?: unknown };
      return Response.json({
        ok: false,
        ...base,
        client: "ours",
        outcome: "sbi-error",
        sbiErrorCode: e?.code !== undefined ? String(e.code) : undefined,
        sbiErrorMessage: typeof e?.message === "string" ? redact(e.message).slice(0, 300) : undefined,
        elapsedMs: Date.now() - started,
      });
    }
  }
  try {
    const [{ SBIEPayClient }, { HttpsProxyAgent }] = await Promise.all([
      import("epay_nodejs_sdk"),
      import("https-proxy-agent"),
    ]);
    const client = new SBIEPayClient(
      { apiKey, apiSecret, encryptionKey },
      env === "live" ? "LIVE" : "SANDBOX",
      false,
    );
    // The SDK builds one axios instance and hands it to every module, so
    // routing that instance routes all of the SDK's calls through the proxy.
    // apiClient is private in the SDK's types but a plain property at runtime.
    const axiosInstance = (client as unknown as {
      apiClient: { defaults: { httpsAgent?: unknown; proxy?: unknown } };
    }).apiClient;
    axiosInstance.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl);
    axiosInstance.defaults.proxy = false;

    const result =
      action === "create"
        ? await client.order.create({
            orderAmount: 1,
            currencyCode: "INR",
            orderRefNumber: ref,
            returnUrl: "https://nutrigreenz.farm/api/payments/sbiepay/callback",
            ...(expiry === undefined || Number.isNaN(expiry) ? {} : { expiry }),
          })
        : await client.order.search({ orderAmount: 1, orderRefNumber: ref });

    const r = result as { status?: unknown; data?: unknown; statusCode?: unknown; message?: unknown };
    const text = JSON.stringify(r ?? {});
    const sbi = parseSbiError(text);
    const outcome = sbi ? "sbi-error" : "success";
    console.info(`sdk-probe: action=${action} outcome=${outcome} code=${sbi?.code ?? "-"}`);
    return Response.json({
      ok: !sbi,
      ...base,
      outcome,
      sbiErrorCode: sbi?.code,
      sbiErrorMessage: sbi?.message,
      transactionUrlPresent: /transactionUrl/.test(text),
      // A ₹1 payment link for an SDKPROBE order, admin-only: returned so the
      // link itself can be opened to see whether SBI's payment page loads.
      ...(action === "create" ? createDetails(result, expiry) : {}),
      raw: sbi ? redact(text).slice(0, 800) : undefined,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    const text = errorText(err);
    const sbi = parseSbiError(text);
    const outcome = sbi ? "sbi-error" : "transport-error";
    console.info(`sdk-probe: action=${action} outcome=${outcome} code=${sbi?.code ?? "-"}`);
    return Response.json({
      ok: false,
      ...base,
      outcome,
      sbiErrorCode: sbi?.code,
      sbiErrorMessage: sbi?.message,
      raw: redact(text).slice(0, 800),
      elapsedMs: Date.now() - started,
    });
  }
}

/**
 * The SDK wraps SBI's errors as JSON inside its own exception, sometimes two
 * levels deep (its catch-all "400" around SBI's own list). Unescape fully and
 * take the LAST errorCode/errorMessage pair: that is SBI's own, innermost one.
 */
function parseSbiError(text: string): { code: string; message: string } | null {
  let flat = text;
  for (let i = 0; i < 4; i++) flat = flat.replace(/\\\\/g, "\\").replace(/\\"/g, '"').replace(/\\n/g, " ");
  const re = /"errorCode"\s*:\s*"?([^",}]+)"?\s*,\s*"errorMessage"\s*:\s*"([^"]*)"/g;
  let last: { code: string; message: string } | null = null;
  for (let m = re.exec(flat); m; m = re.exec(flat)) last = { code: m[1], message: m[2] };
  return last;
}

function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Drop anything URL- or credential-shaped before it leaves the server. */
function redact(text: string): string {
  return text.replace(/https?:\/\/\S+/g, "[url]").replace(/[A-Za-z0-9+/]{30,}={0,2}/g, "[redacted]");
}

/** The non-secret parts of an order/create answer, for diagnosing the payment page. */
function createDetails(result: unknown, sentExpiry: number | undefined) {
  const r = (result ?? {}) as Record<string, unknown>;
  const order = (Array.isArray(r.data) ? r.data[0] : r.data ?? r) as Record<string, unknown> | undefined;
  return {
    sentExpiry: sentExpiry ?? "omitted",
    sbiStatus: order?.status,
    sbiExpiry: order?.expiry,
    sbiOrderRefNumber: order?.sbiOrderRefNumber,
    transactionUrl: typeof order?.transactionUrl === "string" ? order.transactionUrl : undefined,
  };
}
