import { BrandIcon } from "@/components/ui/brand-icon";
import type { VisitorPlaceEntry } from "@/lib/reports";

/**
 * VisitorPlaces — where the people browsing the storefront are.
 *
 * ── What this is, and what it deliberately is not ─────────────────────────
 *
 * Counts, by place, for the selected range. It is not a per-customer location
 * and cannot become one: the underlying table stores a day, a country, a region,
 * a city and a tally — no IP, no session, no customer id, nothing finer than a
 * date. There is no row here that describes an individual, which is what keeps
 * this aggregate statistics rather than the profiling the DPDP Act governs.
 *
 * It answers "which cities should we serve next", not "where is this shopper".
 * The second question needs a different design and a different legal basis, so
 * it is not quietly answerable from this screen.
 *
 * Locations come from Vercel's edge resolution of the connecting address, so no
 * visitor is ever prompted for permission and no third-party geo service sees
 * your traffic.
 */
export function VisitorPlaces({
  places,
  total,
}: {
  places: VisitorPlaceEntry[];
  total: number;
}) {
  const top = places[0]?.visits ?? 0;

  return (
    <section className="rounded-2xl border border-ng-line-soft bg-ng-paper p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[16px] text-ng-forest-deep">
            <BrandIcon name="location" size={16} weight="solid" className="text-ng-leaf" />
            Where visitors come from
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-ng-ink-muted">
            Counted by place, never by person — no address or account is involved.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-ng-sage/50 px-2.5 py-1 text-[13px] font-semibold text-ng-forest-deep">
          {total.toLocaleString("en-IN")} visit{total === 1 ? "" : "s"}
        </span>
      </div>

      {places.length === 0 ? (
        <p className="mt-4 rounded-xl bg-ng-cream px-4 py-6 text-center text-[13px] text-ng-ink-muted">
          Nothing recorded for this range yet. Counting starts with the next visit.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {places.map((p) => {
            const label = [p.city, p.region].filter((v) => v && v !== "unknown").join(", ");
            return (
              <li key={`${p.country}-${p.region}-${p.city}`} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[14px] font-medium text-ng-forest-deep">
                  {label || "Unknown"}
                </span>
                <span className="w-8 shrink-0 text-[12px] uppercase tracking-wide text-ng-ink-soft">
                  {p.country !== "unknown" ? p.country : "—"}
                </span>
                {/* Bar is relative to the busiest place, so the shape of the
                    distribution reads at a glance rather than the absolute size. */}
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ng-sage/40">
                  <span
                    className="block h-full rounded-full bg-ng-leaf"
                    style={{ width: `${top > 0 ? Math.max(4, (p.visits / top) * 100) : 0}%` }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ng-forest-deep">
                  {p.visits.toLocaleString("en-IN")}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
