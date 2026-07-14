import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/**
 * Server-side per-feature guard for the Orders section — covers the list, the
 * per-order detail (`orders/[id]`) and bundles, since they all nest under this
 * segment. Redirects a plain admin lacking `orders` to the overview.
 */
export default async function OrdersSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("orders");
  return <>{children}</>;
}
