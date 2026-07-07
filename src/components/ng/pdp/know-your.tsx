import { PRODUCE_ICONS } from "@/components/ng/produce-icons";
import type { KnowYour as KnowYourData } from "./pdp-content";

interface KnowYourProps {
  data: KnowYourData;
}

/**
 * KnowYour — a "Know your [category]" comparison of variant TYPES (or a
 * "why it's different" comparison for categories without natural sub-types).
 * Produce icons head each column; rows compare an attribute across types.
 * Responsive: a real table on md+, stacked cards on mobile (no overflow at 390).
 */
export function KnowYour({ data }: KnowYourProps) {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[15px] leading-relaxed text-ng-ink-muted">{data.intro}</p>

      {/* Desktop / tablet: comparison table */}
      <div className="hidden overflow-hidden rounded-3xl border border-ng-line-soft md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="bg-ng-forest-deep text-ng-cream">
              <th className="w-36 px-5 py-4 text-[12px] font-semibold uppercase tracking-wider text-ng-cream/70">
                Type
              </th>
              {data.types.map((t) => {
                const Glyph = PRODUCE_ICONS[t.icon] ?? PRODUCE_ICONS.leaf;
                return (
                  <th key={t.name} className="px-5 py-4">
                    <span className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ng-cream/10 text-ng-leaf">
                        <Glyph size={20} className="text-ng-leaf" />
                      </span>
                      <span className="font-display text-[15px] text-ng-cream">{t.name}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-ng-line-soft">
            {data.rows.map((row, ri) => (
              <tr key={row} className="bg-ng-paper transition-colors hover:bg-ng-cream/40">
                <th className="px-5 py-4 text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">{row}</th>
                {data.types.map((t) => (
                  <td key={t.name} className="px-5 py-4 text-[14px] text-ng-forest-deep">
                    {t.values[ri]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked per-type cards */}
      <div className="flex flex-col gap-4 md:hidden">
        {data.types.map((t) => {
          const Glyph = PRODUCE_ICONS[t.icon] ?? PRODUCE_ICONS.leaf;
          return (
            <div key={t.name} className="overflow-hidden rounded-2xl border border-ng-line-soft bg-ng-paper">
              <div className="flex items-center gap-3 bg-ng-forest-deep px-4 py-3 text-ng-cream">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-ng-cream/10">
                  <Glyph size={20} className="text-ng-leaf" />
                </span>
                <span className="font-display text-[15px]">{t.name}</span>
              </div>
              <dl className="divide-y divide-ng-line-soft">
                {data.rows.map((row, ri) => (
                  <div key={row} className="flex items-start justify-between gap-4 px-4 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">{row}</dt>
                    <dd className="text-right text-[13px] font-medium text-ng-forest-deep">{t.values[ri]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
