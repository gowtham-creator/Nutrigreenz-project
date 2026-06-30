/**
 * GET /api/admin/orders — the admin Orders Portal list.
 *
 * Admin/superadmin-gated (shared cookie + `verifyToken` guard). Filterable by
 * `status` (placed|confirmed|packed|shipped|delivered), `paymentStatus`
 * (pending|paid|failed), and a free-text `search` over order number / email /
 * phone; paged via `limit` + `offset`. When Supabase is unconfigured the response
 * is an empty, well-formed page so the UI shows its empty state, never an error.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { isSignedInAdmin } from "../orders/guard";
import {
  listOrdersAdmin,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders";

export const runtime = "nodejs";

const STATUSES: readonly OrderStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];
const PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "paid", "failed"];

export async function GET(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, orders: [], total: 0 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const statusRaw = url.searchParams.get("status") ?? undefined;
  const paymentRaw = url.searchParams.get("paymentStatus") ?? undefined;
  const status = STATUSES.includes(statusRaw as OrderStatus)
    ? (statusRaw as OrderStatus)
    : undefined;
  const paymentStatus = PAYMENT_STATUSES.includes(paymentRaw as PaymentStatus)
    ? (paymentRaw as PaymentStatus)
    : undefined;
  const limitRaw = Number(url.searchParams.get("limit"));
  const offsetRaw = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : undefined;

  const page = await listOrdersAdmin({ search, status, paymentStatus, limit, offset });
  return Response.json({ ok: true, ...page });
}
