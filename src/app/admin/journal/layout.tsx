import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/** Server-side per-feature guard for the Journal section (see the Catalog
 *  layout for the pattern). Redirects a plain admin lacking `journal`. */
export default async function JournalSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("journal");
  return <>{children}</>;
}
