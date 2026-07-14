import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/**
 * Server-side per-feature guard for the People & access section. This route is
 * ALSO super-admin-only at the Edge proxy (unchanged), and managing admins stays
 * super-admin-only in the APIs — granting `people` only ever confers VIEW.
 * Superadmins always pass; this is defense in depth on the `people` grant.
 */
export default async function PeopleSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("people");
  return <>{children}</>;
}
