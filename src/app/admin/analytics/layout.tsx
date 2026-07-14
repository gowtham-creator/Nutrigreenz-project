import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Analytics section. Redirects a plain
 *  admin lacking `analytics` to the overview before the page renders. */
export default async function AnalyticsSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("analytics");
  return <>{children}</>;
}
