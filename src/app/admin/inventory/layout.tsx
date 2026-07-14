import type { ReactNode } from "react";
import { requirePermission } from "@/lib/admin-permissions-guard";

/**
 * Server-side per-feature guard for the Catalog (inventory) section. Runs on
 * every navigation into the segment (hard OR soft) and redirects a plain admin
 * without the `catalog` grant to the overview before the page renders — the
 * authoritative layer above the nav filter.
 */
export default async function CatalogSectionLayout({ children }: { children: ReactNode }) {
  await requirePermission("catalog");
  return <>{children}</>;
}
