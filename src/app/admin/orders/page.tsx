import { requirePermission } from "@/lib/admin-permissions-guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listOrdersAdmin } from "@/lib/orders";
import { buildOrderSummary, periodWindows, type OrderSummary } from "@/lib/order-summary";
import { isSuperAdmin } from "@/app/api/admin/config/guard";
import {
  OrdersClient,
  type OrdersInitialData,
} from "@/components/ng/admin/orders/orders-client";

/**
 * Admin · Orders portal (server shell).
 *
 * Verifies the caller holds the `orders` permission server-side — matching the
 * JSON API's `requireApiPermission("orders")` — then fetches the FIRST page of
 * orders by calling `listOrdersAdmin()` DIRECTLY and streams it to the client as
 * `initialData`, so the pipeline table paints from the initial HTML with no
 * hydrate → effect → fetch waterfall. The initial page size is `100` to mirror
 * the client's own default request. Status filters, free-text search and manual
 * refresh continue to hit the admin-gated API unchanged.
 *
 * On a server-side data error the client receives `null` and falls back to its
 * original mount fetch, preserving the existing loading/empty behavior.
 *
 * The page opens on TODAY: the first page is today's orders (IST), with the
 * today / week / month summary and the delivery slots alongside. Slots can be
 * changed here only by a super admin, the same rule as the config API.
 */
export const runtime = "nodejs";

export default async function AdminOrdersPage() {
  await requirePermission("orders");

  const canEditSlots = await isSuperAdmin();

  let initialData: OrdersInitialData | null;
  let initialSummary: OrderSummary | null = null;
  if (!isSupabaseConfigured) {
    initialData = { orders: [], total: 0 };
  } else {
    const now = new Date();
    const today = periodWindows(now).today;
    const [page, summary] = await Promise.allSettled([
      listOrdersAdmin({ limit: 100, placedFrom: today.from, placedTo: today.to }),
      buildOrderSummary(now),
    ]);
    initialData =
      page.status === "fulfilled" ? { orders: page.value.orders, total: page.value.total } : null;
    initialSummary = summary.status === "fulfilled" ? summary.value : null;
  }

  return (
    <OrdersClient initialData={initialData} initialSummary={initialSummary} canEditSlots={canEditSlots} />
  );
}
