import { requirePermission } from "@/lib/admin-permissions-guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listCustomers } from "@/lib/admin-customers";
import {
  CustomersClient,
  type CustomerPage,
} from "@/components/ng/admin/customers/customers-client";

/**
 * Admin · Customers (server shell).
 *
 * Verifies the caller holds the `customers` permission server-side — the same
 * authorization the JSON API enforces via `requireApiPermission("customers")` —
 * and redirects unauthorized operators BEFORE any customer PII is rendered
 * (defense in depth above the Edge proxy). It then fetches the FIRST page of the
 * deduped directory by calling `listCustomers()` DIRECTLY (no HTTP round-trip)
 * and hands it to the interactive client as `initialData`, so the first screen
 * of data ships in the initial HTML instead of arriving after hydrate → effect →
 * fetch. Search, the detail drawer and manual refresh still call the admin-gated
 * API exactly as before.
 *
 * On a server-side data error the client receives `null` and transparently falls
 * back to its original mount fetch, preserving the existing error UX.
 */
export const runtime = "nodejs";

export default async function AdminCustomersPage() {
  await requirePermission("customers");

  let initialData: CustomerPage | null;
  if (!isSupabaseConfigured) {
    initialData = { ok: true, customers: [], total: 0, identitiesTotal: 0, customersTotal: 0 };
  } else {
    try {
      const page = await listCustomers({});
      initialData = { ok: true, ...page };
    } catch {
      initialData = null;
    }
  }

  return <CustomersClient initialData={initialData} />;
}
