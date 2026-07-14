import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/**
 * Server-side per-feature guard for the Marketing section. This route is ALSO
 * super-admin-only at the Edge proxy (unchanged), so a plain admin is already
 * bounced there; this guard is defense in depth on the effective `marketing`
 * grant (superadmins always pass).
 */
export default async function MarketingSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("marketing");
  return <>{children}</>;
}
