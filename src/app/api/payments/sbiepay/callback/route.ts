import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getOrder, setOrderPayment } from "@/lib/orders";
import { confirmGatewayPayment, isOnlinePaymentAvailable } from "@/lib/payments";

export const runtime = "nodejs";
// Never cached: this is the moment money is confirmed.
export const dynamic = "force-dynamic";

/**
 * The gateway return endpoint. SBIePay sends the customer's browser here after
 * they pay, and separately posts a server-to-server notification to the same
 * place.
 *
 * ── The rule this route exists to enforce ─────────────────────────────────
 *
 * An order is marked paid because the GATEWAY says so, verified on this server,
 * and for no other reason. The customer arrives here with a payload they could
 * have edited — a redirect is just a URL — so the incoming parameters are used
 * ONLY to identify which order to ask about. Whether it was paid, and for how
 * much, comes from `confirmGatewayPayment`, which checks the gateway's own
 * signature.
 *
 * The amount is re-checked too. A signed response that says ₹1 was captured on
 * a ₹2,200 order is a valid signature over a wrong amount, and treating that as
 * payment would be a way to buy anything for a rupee.
 *
 * ── Why it always redirects ───────────────────────────────────────────────
 *
 * A person is on the other end of this request. Whatever happens, they get sent
 * to a page that tells them where they stand. A JSON error body would leave a
 * customer who has just been charged staring at a stack trace.
 */

/** Where to send the customer, given what we concluded. */
function redirectTo(path: string, params: Record<string, string>): Response {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";
  const url = new URL(path, site);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 303);
}

/** Collect the gateway's fields whether they arrive as a form post or a query. */
async function readPayload(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) out[k] = v;

  if (request.method === "POST") {
    const type = request.headers.get("content-type") ?? "";
    try {
      if (type.includes("application/json")) {
        const body = (await request.json()) as Record<string, unknown>;
        for (const [k, v] of Object.entries(body)) out[k] = String(v);
      } else {
        // SBIePay posts form-encoded on the browser return leg.
        for (const [k, v] of (await request.formData()).entries()) {
          out[k] = typeof v === "string" ? v : "";
        }
      }
    } catch {
      // A malformed body is not fatal on its own — the query string may still
      // carry the order reference, and the verification step decides the rest.
    }
  }
  return out;
}

/**
 * Which order this callback is about.
 *
 * Read from the payload only to LOOK UP the order. Several field names are
 * tried because the browser leg and the server notification do not always agree
 * on spelling, and failing to find the order would strand a real payment.
 */
function orderNumberFrom(payload: Record<string, string>): string | null {
  for (const key of ["orderNumber", "order_number", "merchantOrderNo", "orderId", "udf1"]) {
    const value = payload[key]?.trim();
    if (value) return value;
  }
  return null;
}

async function handle(request: Request): Promise<Response> {
  if (!isSupabaseConfigured || !isOnlinePaymentAvailable()) {
    return redirectTo("/checkout/failed", { reason: "unavailable" });
  }

  const payload = await readPayload(request);
  const orderNumber = orderNumberFrom(payload);
  if (!orderNumber) {
    return redirectTo("/checkout/failed", { reason: "no-reference" });
  }

  // getOrder resolves either an id or an order number.
  const order = await getOrder(orderNumber);
  if (!order) {
    return redirectTo("/checkout/failed", { reason: "unknown-order" });
  }

  /*
   * Already settled: stop here and send them to the receipt.
   *
   * The browser return and the server notification both land on this route, and
   * a customer may also refresh it. Without this, a second arrival would
   * re-process a completed payment.
   */
  if (order.paymentStatus === "paid") {
    return redirectTo("/checkout/success", { order: order.orderNumber });
  }

  const result = await confirmGatewayPayment(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      totalPaise: order.totalPaise,
      currency: order.currency,
      customerEmail: order.userEmail,
      customerPhone: order.userPhone,
    },
    payload,
  );

  if (!result.ok) {
    await setOrderPayment(order.id, "failed", result.reference ?? null);
    return redirectTo("/checkout/failed", {
      order: order.orderNumber,
      reason: result.reason ?? "declined",
    });
  }

  /*
   * Verified — but check the amount before believing it.
   *
   * A correctly signed response can still state a captured amount that is not
   * what the order costs. Accepting it would let anyone pay a rupee for
   * anything. A short capture is recorded as failed and left for a human,
   * because it means something is wrong that code should not paper over.
   */
  if (result.capturedPaise !== null && result.capturedPaise < order.totalPaise) {
    await setOrderPayment(order.id, "failed", result.reference ?? null);
    return redirectTo("/checkout/failed", {
      order: order.orderNumber,
      reason: "amount-mismatch",
    });
  }

  await setOrderPayment(order.id, "paid", result.reference ?? null);
  return redirectTo("/checkout/success", { order: order.orderNumber });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
