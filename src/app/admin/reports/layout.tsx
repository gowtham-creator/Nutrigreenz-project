import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Reports section. Redirects a plain
 *  admin lacking `reports` to the overview before the page renders. */
export default async function ReportsSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("reports");
  return <>{children}</>;
}
