import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Customers section. Redirects a plain
 *  admin lacking `customers` to the overview before the page renders. */
export default async function CustomersSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("customers");
  return <>{children}</>;
}
