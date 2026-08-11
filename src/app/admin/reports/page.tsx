import { requirePermission } from "@/lib/admin-permissions-guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { buildAdminReport, type AdminReport } from "@/lib/reports";
import { ReportsClient } from "@/components/ng/admin/reports/reports-client";

/**
 * Admin · Reports & analytics (server shell).
 *
 * Verifies the caller holds the `reports` permission server-side — matching the
 * JSON API's `requireApiPermission("reports")` — then computes the default
 * "All time" report by calling `buildAdminReport()` DIRECTLY and streams it to
 * the client as `initialReport`, so the KPIs and charts paint with real figures
 * in the initial HTML instead of after hydrate → effect → fetch. Selecting a
 * different date range still re-queries the admin-gated API unchanged. Money is
 * integer paise throughout.
 *
 * On a server-side data error the client receives `null` and falls back to its
 * original mount fetch, preserving the existing loading/empty behavior.
 */
export const runtime = "nodejs";

/** A well-formed empty report (mirrors the API route's unconfigured fallback). */
function emptyReport(): AdminReport {
  return {
    range: { from: null, to: null },
    revenuePaise: 0,
    orderCount: 0,
    aovPaise: 0,
    unitsSold: 0,
    paidRevenuePaise: 0,
    statusBreakdown: [],
    paymentBreakdown: [],
    topProducts: [],
    couponUsage: [],
    newCustomers: 0,
  visitorPlaces: [],
  visitorTotal: 0,
  };
}

export default async function AdminReportsPage() {
  await requirePermission("reports");

  let initialReport: AdminReport | null;
  if (!isSupabaseConfigured) {
    initialReport = emptyReport();
  } else {
    try {
      initialReport = await buildAdminReport({ from: null, to: null });
    } catch {
      initialReport = null;
    }
  }

  return <ReportsClient initialReport={initialReport} />;
}
