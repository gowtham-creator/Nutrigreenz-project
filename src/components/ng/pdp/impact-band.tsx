import { Icon } from "@/components/ui/icon";
import { FooterScene } from "@/components/ng/footer-scene";
import { Reveal } from "@/components/ng/motion";
import type { PdpCategoryContent } from "./pdp-content";

interface ImpactBandProps {
  impact: PdpCategoryContent["impact"];
}

/**
 * ImpactBand — "Healthier families, happier farmers" stats band on a deep-forest
 * field illustration (no photos).
 */
export function ImpactBand({ impact }: ImpactBandProps) {
  return (
    <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-ng-forest-deep via-ng-forest to-ng-forest-deep px-6 py-12 text-ng-cream sm:px-10 sm:py-16">
      <div className="text-ng-forest-soft/60">
        <FooterScene />
      </div>
      <div className="relative z-10 flex flex-col gap-10">
        <Reveal className="flex max-w-2xl flex-col gap-3">
          <h2 className="font-display text-[clamp(26px,3.6vw,40px)] leading-tight text-ng-cream">{impact.title}</h2>
          <p className="text-[15px] leading-relaxed text-ng-cream/75">{impact.subtitle}</p>
        </Reveal>
        <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {impact.stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06} className="h-full">
              <li className="flex h-full flex-col gap-2 rounded-2xl border border-ng-cream/12 bg-ng-cream/[0.06] p-5 backdrop-blur-sm">
                <Icon name={s.icon} size={24} className="text-ng-clay" />
                <span className="font-display text-3xl text-ng-cream tabular-nums">{s.value}</span>
                <span className="text-[13px] text-ng-cream/70">{s.label}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
