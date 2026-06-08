import { Icon } from "@/components/ui/icon";

/**
 * Certifications — text + Solar-icon badges (no copyrighted logos).
 */
export function Certifications() {
  const certs = [
    { icon: "shield-check-bold", label: "FSSAI", sub: "Licensed" },
    { icon: "verified-check-bold", label: "ISO 22000", sub: "Food safety" },
    { icon: "medal-star-bold", label: "GMP", sub: "Good mfg." },
    { icon: "checklist-minimalistic-bold", label: "HACCP", sub: "Hazard control" },
    { icon: "test-tube-bold", label: "Lab-tested", sub: "Every lot" },
  ];
  return (
    <ul className="flex flex-wrap items-stretch justify-center gap-3">
      {certs.map((c) => (
        <li
          key={c.label}
          className="flex min-w-[110px] flex-1 items-center gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper px-4 py-3 sm:max-w-[180px]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest">
            <Icon name={c.icon} size={20} className="text-ng-leaf" />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-ng-forest-deep">{c.label}</span>
            <span className="text-[11px] text-ng-ink-muted">{c.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
