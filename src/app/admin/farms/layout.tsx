import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Farms section. Redirects a plain admin
 *  lacking `farms` to the overview before the page renders. */
export default async function FarmsSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("farms");
  return <>{children}</>;
}
