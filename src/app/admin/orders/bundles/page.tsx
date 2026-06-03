import Link from "next/link";
import { AdminShell } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { BundlesView } from "@/components/ng/admin/bundles/bundles-view";

export default function AdminOrderBundles() {
  return (
    <AdminShell
      active="/admin/orders"
      title="Community bundles"
      subtitle="Confirmed orders grouped by gated community + delivery date"
      actions={
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors"
        >
          <Icon name="arrow-left-bold" size={14} />
          Back to orders
        </Link>
      }
    >
      <BundlesView />
    </AdminShell>
  );
}
