import Image from "next/image";
import Link from "next/link";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Chip } from "@/components/ng/chip";
import { Reveal } from "@/components/ng/motion";
import { listFarms } from "@/lib/content";

export const revalidate = 60;

const REGIONS = ["All regions", "Andhra Pradesh", "Telangana", "Tamil Nadu", "Kerala", "Gujarat", "Maharashtra"];
const PRACTICES = ["All practices", "Organic", "A2 dairy", "Cooperative", "Biodynamic", "Rainwater harvesting"];

export default async function FarmsPage() {
  // Reads the DB (falls back to the static sample content when unconfigured/empty).
  const farms = await listFarms();

  return (
    <PageShell>
      <PageHero
        tint="field"
        image="/images/farms/farms-hero.webp"
        eyebrow="42 partner farms · 7 states"
        title={<>The hands that <em className="italic text-ng-leaf">feed your pantry.</em></>}
        description="We don't say 'sourced from select farmers.' We name every one. Each farm is a long-term partnership: minimum 3-year contracts, soil-health programmes, transition financing for organic conversion."
      />

      {/* Filters */}
      <div className="border-b border-ng-line-soft bg-ng-paper sticky top-[60px] z-30 glass-strong">
        <div className="mx-auto max-w-7xl px-5 md:px-8 py-4 flex flex-wrap gap-3 items-center">
          <span className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mr-2">Region</span>
          {REGIONS.map((r, i) => (
            <Chip key={r} data-active={i === 0 ? "true" : undefined}>{r}</Chip>
          ))}
          <span className="text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mr-2 ml-4">Practice</span>
          {PRACTICES.map((p, i) => (
            <Chip key={p} data-active={i === 0 ? "true" : undefined}>{p}</Chip>
          ))}
        </div>
      </div>

      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {farms.map((f, i) => {
            const since = f.partneredSince ? new Date(f.partneredSince).getFullYear() : null;
            return (
              <Reveal key={f.id} className="h-full" delay={(i % 3) * 0.08}>
                <Link
                  href={`/farms/${f.id}`}
                  className="group flex h-full flex-col rounded-3xl overflow-hidden bg-ng-paper border border-ng-line-soft hover:-translate-y-0.5 hover:shadow-[var(--shadow-ng-card)] transition-all"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={f.image ?? "/images/placeholder.svg"}
                      alt={f.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep/70 via-transparent" />
                    {since ? (
                      <span className="absolute top-3 left-3 ng-chip bg-ng-cream/90 text-ng-forest-deep border-ng-cream">
                        Partner since {since}
                      </span>
                    ) : null}
                    <span className="absolute bottom-3 left-3 right-3 font-display text-[22px] text-ng-cream leading-tight">
                      {f.name}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-[13px] text-ng-ink-soft">{f.region}{f.hectares ? ` · ${f.hectares} ha` : ""}</p>
                    <p className="text-[14px] text-ng-ink-muted mt-3 leading-relaxed line-clamp-3">{f.story}</p>
                    <div className="mt-auto pt-4 flex flex-wrap gap-2">
                      {f.practices.slice(0, 3).map((p) => (
                        <span key={p} className="text-[11px] px-2.5 py-1 rounded-full bg-ng-cream border border-ng-forest-deep/30 text-ng-forest-deep capitalize">{p}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </Section>
    </PageShell>
  );
}
