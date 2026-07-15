import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Captains section. Redirects a plain
 *  admin lacking `captains` to the overview before the page renders. */
export default async function CaptainsSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("captains");
  return <>{children}</>;
}
