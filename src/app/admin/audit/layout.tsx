import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Audit log section. Redirects a plain
 *  admin lacking `audit` to the overview before the page renders. */
export default async function AuditSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("audit");
  return <>{children}</>;
}
