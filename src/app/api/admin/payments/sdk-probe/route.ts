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

  const action = new URL(request.url).searchParams.get("action") === "create" ? "create" : "search";
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
            expiry: 25,
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
      sbiErrorMessage: sbi?.message ?? (sbi ? undefined : redact(text).slice(0, 200)),
      elapsedMs: Date.now() - started,
    });
  }
}

/** The SDK wraps SBI's errors as JSON strings inside its own exception. */
function parseSbiError(text: string): { code: string; message: string } | null {
  const m = /"errorCode"\s*:\s*"?([^",}\\]+)"?[^}]*?"errorMessage"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(
    text.replace(/\\"/g, '"'),
  );
  return m ? { code: m[1], message: m[2] } : null;
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
