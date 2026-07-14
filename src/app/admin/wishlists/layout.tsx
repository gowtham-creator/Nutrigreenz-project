import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Wishlists section. Redirects a plain
 *  admin lacking `wishlists` to the overview before the page renders. */
export default async function WishlistsSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("wishlists");
  return <>{children}</>;
}
