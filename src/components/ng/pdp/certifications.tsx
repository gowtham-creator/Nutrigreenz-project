import { Icon } from "@/components/ui/icon";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

/**
 * Certifications — text + icon badges, and deliberately no certification LOGOS.
 *
 * A regulator's or auditor's mark is not decoration: displaying it asserts a
 * live, verifiable certification, and several of these carry conditions on how
 * and where the mark may appear. A wordmark badge makes the same claim without
 * borrowing artwork we have no licence to reproduce.
 */
export function Certifications() {
  const certs: ({ label: string; sub: string } & ({ app: AppIconName } | { icon: string }))[] = [
    /*
     * FSSAI stays a text badge, deliberately.
     *
     * The logo file supplied for it is a Shutterstock preview (the "260nw"
     * in its name is their watermark-size naming), which cannot go on a
     * commercial page. The mark itself is also only displayable alongside the
     * 14-digit licence number, and ours is still a placeholder in the pack
     * artwork. Both have to be settled before a logo replaces this.
     */
    { icon: "shield-check-bold", label: "FSSAI", sub: "Licensed" },
    { icon: "verified-check-bold", label: "ISO 22000", sub: "Food safety" },
    { icon: "medal-star-bold", label: "GMP", sub: "Good mfg." },
    { icon: "checklist-minimalistic-bold", label: "HACCP", sub: "Hazard control" },
    { app: "lab" as const, label: "Lab-tested", sub: "Every lot" },
  ];
  return (
    <ul className="flex flex-wrap items-stretch justify-center gap-3">
      {certs.map((c) => (
        <li
          key={c.label}
          className="flex min-w-[110px] flex-1 items-center gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper px-4 py-3 sm:max-w-[180px]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-leaf">
            {"app" in c ? <AppIcon name={c.app} size={20} /> : <Icon name={c.icon} size={20} />}
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
