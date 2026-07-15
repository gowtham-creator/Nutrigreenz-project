import { requirePermission } from "@/lib/admin-permissions-guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listOrdersAdmin } from "@/lib/orders";
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
 */
export const runtime = "nodejs";

export default async function AdminOrdersPage() {
  await requirePermission("orders");

  let initialData: OrdersInitialData | null;
  if (!isSupabaseConfigured) {
    initialData = { orders: [], total: 0 };
  } else {
    try {
      const page = await listOrdersAdmin({ limit: 100 });
      initialData = { orders: page.orders, total: page.total };
    } catch {
      initialData = null;
    }
  }

  return <OrdersClient initialData={initialData} />;
}
