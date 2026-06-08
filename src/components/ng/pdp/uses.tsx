import { Icon } from "@/components/ui/icon";
import type { UseTip } from "./pdp-content";

interface UsesProps {
  intro: string;
  tips: UseTip[];
}

/**
 * Uses — category-specific usage tips. The key phrase of each tip is bolded.
 */
export function Uses({ intro, tips }: UsesProps) {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[15px] leading-relaxed text-ng-ink-muted">{intro}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tips.map((t) => (
          <li
            key={t.key}
            className="flex items-start gap-3 rounded-2xl border border-ng-line-soft bg-ng-paper p-4"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ng-sage/50 text-ng-forest">
              <Icon name="chef-hat-bold" size={16} className="text-ng-leaf" />
            </span>
            <p className="text-[14px] leading-relaxed text-ng-ink">
              <span className="font-semibold text-ng-forest-deep">{t.key}</span>
              {t.rest}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
