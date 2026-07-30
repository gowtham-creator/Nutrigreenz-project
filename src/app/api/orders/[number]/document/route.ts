import { cookies } from "next/headers";
import { getCustomerSession } from "@/lib/customer-session";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { getOrder } from "@/lib/orders";
import { buildInvoicePdf, buildReceiptPdf } from "@/lib/invoice-pdf";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

// pdf-lib + the Supabase service client need the Node runtime.
export const runtime = "nodejs";

/**
 * GET /api/orders/[number]/document?doc=invoice|receipt
 *
 * Streams the tax invoice, or the receipt, for a single order. The same
 * generator used for the email attachments, so a customer downloading later gets
 * a document identical to the one they were sent.
 *
 * Access is deliberately narrow:
 *   · the customer the order belongs to, resolved from the signed session; or
 *   · a signed-in operator, who legitimately needs it for support.
 * A logged-out request is refused even with a valid order number — the number
 * appears in emails and would otherwise be enough to read someone's address and
 * order history.
 *
 * A receipt is only issued once payment has actually been taken. Producing one
 * for an unpaid order would be a false record of payment, so that is a 409
 * rather than a silently empty document.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ number: string }> },
): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const { number } = await ctx.params;
  const doc = new URL(request.url).searchParams.get("doc") === "receipt" ? "receipt" : "invoice";

  const order = await getOrder(number);
  if (!order) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // Owner, or any authenticated operator.
  const session = await getCustomerSession();
  const isOwner = Boolean(session && order.customerId && order.customerId === session.customerId);
  let isOperator = false;
  if (!isOwner) {
    const admin = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
    isOperator = Boolean(admin);
  }
  if (!isOwner && !isOperator) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (doc === "receipt" && order.paymentStatus !== "paid") {
    return Response.json(
      { ok: false, error: "not-paid", message: "A receipt is available once payment is complete." },
      { status: 409 },
    );
  }

  const bytes = doc === "receipt" ? await buildReceiptPdf(order) : await buildInvoicePdf(order);
  const filename = `${doc === "receipt" ? "Receipt" : "Invoice"}-${order.orderNumber}.pdf`;

  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      // A billing document must never be cached by a shared proxy: it is
      // personal, and the order's payment state can change.
      "cache-control": "private, no-store",
    },
  });
}
