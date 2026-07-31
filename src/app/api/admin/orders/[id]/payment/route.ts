/**
 * POST /api/admin/orders/[id]/payment — record that cash on delivery was collected.
 *
 * Deliberately narrow: it only ever moves a COD order from pending to paid, and
 * only a signed-in operator with the `orders` permission can call it.
 *
 * It refuses a UPI order outright. An online payment becomes paid because the
 * gateway said so on a verified server-side callback — never because someone
 * clicked a button in the admin. Allowing that here would open a way to mark an
 * order paid with no money behind it, which is exactly the hole this endpoint
 * must not create.
 *
 * The move is recorded as a status event credited to the operator's email,
 * because this is the action that turns an order into revenue and so has to be
 * attributable to a person.
 */
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { requireApiPermission } from "@/lib/admin-api-guard";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireApiPermission("orders");
  if (denied) return denied;
  const session = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ ok: false, error: "not-found" }, { status: 404 });

  if (order.paymentMethod !== "cod") {
    return Response.json(
      {
        ok: false,
        error: "not-cod",
        message: "Online payments are confirmed by the gateway, not by hand.",
      },
      { status: 409 },
    );
  }
  if (order.paymentStatus === "paid") {
    // Idempotent: a double-click must not move paid_at forward or write a
    // second event.
    return Response.json({ ok: true, alreadyPaid: true, paidAt: order.paidAt });
  }

  const paidAt = new Date().toISOString();
  const db = supabaseAdmin();
  const { error } = await db
    .from("orders")
    .update({ payment_status: "paid", paid_at: paidAt })
    .eq("id", order.id);

  if (error) {
    return Response.json({ ok: false, error: "save-failed" }, { status: 500 });
  }

  await db.from("order_status_events").insert({
    order_id: order.id,
    status: order.status,
    by: session.email ?? "admin",
    note: `Cash on delivery collected — ${(order.totalPaise / 100).toFixed(2)}`,
  });

  return Response.json({ ok: true, paidAt });
}
