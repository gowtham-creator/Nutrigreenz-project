import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ng/motion";
import type { WayCard } from "./pdp-content";

interface TheWayProps {
  cards: WayCard[];
}

/**
 * TheWay — "The Nutri Greenz Way" benefit cards. Image-led via illustrated
 * tint + Solar icon, not photography. Equal-height cards.
 */
export function TheWay({ cards }: TheWayProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <Reveal key={card.title} delay={i * 0.06} className="h-full">
          <article className="group flex h-full flex-col gap-4 rounded-3xl border border-ng-line-soft bg-ng-paper p-6 transition-colors hover:border-ng-leaf-soft">
            {/* illustrated tinted header tile */}
            <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-ng-sage/60 via-ng-cream to-ng-cream-deep">
              <div aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-ng-leaf/15 blur-2xl" />
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ng-paper text-ng-forest shadow-[var(--shadow-ng-card)]">
                <Icon name={card.icon} size={28} className="text-ng-leaf" />
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-xl text-ng-forest-deep">{card.title}</h3>
              <p className="text-[14px] leading-relaxed text-ng-ink">{card.body}</p>
            </div>
            <ul className="mt-auto flex flex-col gap-2 border-t border-ng-line-soft pt-4">
              {card.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-[13px] text-ng-ink-muted">
                  <Icon name="check-circle-bold" size={15} className="mt-0.5 shrink-0 text-ng-leaf" />
                  {pt}
                </li>
              ))}
            </ul>
          </article>
        </Reveal>
      ))}
    </div>
  );
}
