import { Icon } from "@/components/ui/icon";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

interface TrustRowProps {
  checks: number;
}

/**
 * TrustRow — 4 icon+label reassurance items. Returns wording respects the
 * No-Cancellation policy: replacements only for damaged / incorrect items.
 */
export function TrustRow({ checks }: TrustRowProps) {
  /*
   * `app` names come from the imported Icons8 glyphs, `icon` from Solar. Both
   * paint with currentColor, so the row stays one visual system — the shipping
   * glyph carries its own "FREE" lettering, which says the offer better than a
   * generic van, and the lab flask reads as testing rather than chemistry.
   */
  const items: ({ label: string; sub: string } & ({ app: AppIconName } | { icon: string }))[] = [
    { app: "shipping-free", label: "Free shipping", sub: "On orders over ₹599" },
    { icon: "headphones-round-sound-bold", label: "Customer support", sub: "We reply within a day" },
    { icon: "box-bold", label: "Damage replacements", sub: "Damaged or incorrect items only" },
    { app: "lab", label: `${checks}+ quality checks`, sub: "On every single lot" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((t) => (
        <li
          key={t.label}
          className="flex h-full flex-col items-center gap-2 rounded-2xl border border-ng-line-soft bg-ng-paper px-3 py-5 text-center"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-ng-sage/50 text-ng-leaf">
            {"app" in t ? (
              <AppIcon name={t.app} size={22} />
            ) : (
              <Icon name={t.icon} size={22} />
            )}
          </span>
          <span className="text-[13px] font-semibold text-ng-forest-deep">{t.label}</span>
          <span className="text-[11px] leading-snug text-ng-ink-muted">{t.sub}</span>
        </li>
      ))}
    </ul>
  );
}
