import { redirect } from "next/navigation";
import { getOrder } from "@/lib/orders";

/**
 * Legacy `/orders/[id]` — retired. This route previously rendered a mock order
 * from sample `MOCK_LINES`/`PRODUCTS`; the real order detail now lives at
 * `/account/orders/[orderNumber]` (auth-gated, ownership-checked). Order-placed
 * emails historically deep-linked here by order id, so we resolve the id (or
 * number) to its order number and redirect to the real route, falling back to
 * the account orders list when it can't be resolved.
 */
export const runtime = "nodejs";

export default async function LegacyOrderRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id).catch(() => null);
  redirect(order ? `/account/orders/${encodeURIComponent(order.orderNumber)}` : "/account/orders");
}
