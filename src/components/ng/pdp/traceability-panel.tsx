import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import type { Farm } from "@/types/nutrigreenz";

interface TraceabilityPanelProps {
  lotCode: string;
  farm: Farm;
  harvestDate: string;
  labReportHref?: string;
}

/**
 * Lot & traceability panel — surfaces the identity scope: lot code, partner farm,
 * harvest date, lab report link, and a QR-style scan note.
 */
export function TraceabilityPanel({ lotCode, farm, harvestDate, labReportHref = "#" }: TraceabilityPanelProps) {
  const rows = [
    { icon: "qr-code-bold", label: "Lot code", value: lotCode },
    { icon: "leaf-bold", label: "Partner farm", value: `${farm.name} · ${farm.region}` },
    { icon: "calendar-bold", label: "Harvest / pressed", value: harvestDate },
    { icon: "customer", label: "Farmer", value: farm.farmerName ?? "Verified partner" },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-cream">
      <div className="flex items-center gap-3 border-b border-ng-line-soft bg-ng-forest-deep px-6 py-4 text-ng-cream">
        <Icon name="map-point-wave-bold" size={22} className="text-ng-leaf" />
        <div>
          <p className="font-display text-lg leading-tight text-ng-cream">Lot &amp; traceability</p>
          <p className="text-[12px] text-ng-cream/70">Every batch is traceable to its source.</p>
        </div>
      </div>

      <div className="grid gap-px bg-ng-line-soft sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 bg-ng-cream px-6 py-4">
            <Icon name={row.icon} size={18} className="mt-0.5 text-ng-leaf" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">{row.label}</p>
              <p className="text-[14px] font-medium text-ng-forest-deep">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      {farm.practices?.length ? (
        <div className="flex flex-wrap gap-2 border-t border-ng-line-soft px-6 py-4">
          {farm.practices.map((p) => (
            <span
              key={p}
              className="rounded-full border border-ng-leaf-soft bg-ng-paper px-3 py-1 text-[12px] capitalize text-ng-forest"
            >
              {p}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-ng-line-soft px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-ng-line bg-ng-paper">
            <Icon name="qr-code-bold" size={28} className="text-ng-forest" />
          </div>
          <p className="text-[12px] leading-snug text-ng-ink-muted">
            Scan the QR on your label to
            <br />
            replay this lot&apos;s full journey.
          </p>
        </div>
        <Link
          href={labReportHref}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-ng-forest px-4 py-2 text-[13px] font-medium text-ng-forest transition-colors hover:bg-ng-forest hover:text-ng-paper"
        >
          <Icon name="document-text-bold" size={16} />
          View lab report
        </Link>
      </div>
    </div>
  );
}
