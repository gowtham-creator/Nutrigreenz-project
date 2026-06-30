/**
 * GET /api/admin/orders/[id] — a single order's full detail for the Orders
 * Portal. Admin/superadmin-gated. `[id]` accepts the internal uuid id OR the
 * human order number (NG-YY-XXXX). Unlike the customer route this is not
 * ownership-scoped — any signed-in admin may view any order.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../guard";
import { getOrder } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return Response.json({ ok: true, order });
}
