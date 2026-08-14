import Link from "next/link";
import { AdminShell, Card } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { RolesAndLogs } from "@/components/ng/admin/super/roles-and-logs";

/**
 * People & access.
 *
 * The customer directory link, the REAL admin roster (add / edit / reset /
 * activate / delete, backed by `/api/admin/admins`), the two-role capability
 * matrix (admin vs superadmin), and a live system activity trail
 * (`/api/admin/activity`). No fabricated team/role/captain data — the roster
 * and activity feed are the single source of truth.
 */
export default function AdminPeople() {
  return (
    <AdminShell
      active="/admin/people"
      title={
        <span>
          People <em className="italic text-ng-clay font-display">&amp; access</em>
        </span>
      }
      subtitle="The customer directory, your admin roster, roles, and a live system activity trail"
    >
      {/* Customers — the deduped canonical directory, on its own page. */}
      <Card title="Customers" className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="size-12 rounded-2xl bg-ng-cream flex items-center justify-center shrink-0">
            <UiIcon name="customer" size={24} className="text-ng-forest" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] text-ng-forest-deep">Deduped customer directory</p>
            <p className="text-[12.5px] font-medium text-ng-ink-muted mt-0.5 leading-relaxed">
              One canonical row per real person — Google and phone sign-ins folded into a single
              customer, with linked providers, mobile, email and saved addresses.
            </p>
          </div>
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer shrink-0"
          >
            Open customers
            <Icon name="arrow-right-linear" size={14} />
          </Link>
        </div>
      </Card>

      {/* Real admin roster + role capability matrix + live activity trail. */}
      <RolesAndLogs />
    </AdminShell>
  );
}
