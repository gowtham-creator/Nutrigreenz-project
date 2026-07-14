import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/**
 * Server-side per-feature guard for the Config (Super Admin control center)
 * section. This route is ALSO super-admin-only at the Edge proxy (unchanged) and
 * every config API stays super-admin-only; superadmins always pass. Defense in
 * depth on the `config` grant.
 */
export default async function ConfigSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("config");
  return <>{children}</>;
}
