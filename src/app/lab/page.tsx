import Link from "next/link";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";

const TESTS = [
  { name: "Pesticide residue", limit: "FSSAI compliant — 0 ppm tolerance for organochlorines", method: "GC-MS multi-residue scan (172 compounds)" },
  { name: "Aflatoxin B1", limit: "< 2 ppb (FSSAI: 30 ppb)", method: "HPLC-FLD with immunoaffinity cleanup" },
  { name: "Heavy metals", limit: "Lead < 0.1 ppm · Cadmium < 0.05 ppm · Arsenic < 0.05 ppm", method: "ICP-MS digest" },
  { name: "Adulteration check", limit: "Pure A2 — no skim, no foreign fats, no preservatives", method: "FTIR fingerprint vs reference library" },
  { name: "Microbial load", limit: "Total plate count < 10,000 CFU/g · No Salmonella · No E. coli", method: "Membrane filtration culture, 72-hour incubation" },
  { name: "Moisture content", limit: "Within ±0.5% of declared", method: "Karl Fischer titration" },
  { name: "Nutritional panel", limit: "Within ±5% of label claim", method: "AOAC certified methods for protein, fat, fibre, ash" },
  { name: "Fatty acid profile", limit: "Cold-pressed signature: high MUFA, low trans", method: "GC-FID with capillary column" },
];

const PARTNERS = [
  { name: "Eurofins Analytical Services", role: "Pesticides, mycotoxins, heavy metals", accred: "NABL · ISO/IEC 17025:2017" },
  { name: "TÜV SÜD South Asia", role: "Adulteration, microbial, nutritional", accred: "NABL · BIS approved" },
  { name: "Nutri Greenz in-house QC", role: "First-line sensory + moisture", accred: "FSSAI certified facility" },
];

const SAMPLE_REPORTS = [
  { lot: "ANT-24-051", product: "Cold-Pressed Groundnut Oil", date: "12 Feb 2026", pages: 14, partner: "Eurofins" },
  { lot: "ANT-24-049", product: "A2 Bilona Ghee", date: "08 Feb 2026", pages: 11, partner: "TÜV SÜD" },
  { lot: "ANT-24-044", product: "Stone-Ground Bajra Flour", date: "01 Feb 2026", pages: 9, partner: "Eurofins" },
  { lot: "ANT-24-038", product: "Multi-Floral Forest Honey", date: "24 Jan 2026", pages: 13, partner: "TÜV SÜD" },
];

export default function LabPage() {
  return (
    <PageShell>
      <PageHero
        tone="forest"
        eyebrow="The Nutrigreenz lab desk"
        title={<>Every batch. <em className="italic text-ng-clay">Three labs.</em> One verdict.</>}
        description="We do not sell anything we have not tested. Every lot goes through eight checks across two NABL-accredited labs plus our in-house QC. If anything fails, the lot does not ship — full stop."
      />

      <Section>
        {/* What we test for */}
        <div className="mb-20">
          <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
            <div>
              <span className="ng-eyebrow">What we test for</span>
              <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mt-3 leading-tight">
                Eight tests. <em className="italic text-ng-leaf">No exceptions.</em>
              </h2>
            </div>
            <p className="text-[15px] text-ng-ink-muted max-w-md">
              These limits are tighter than FSSAI minimums. We've built our own reference library after eight years of testing — anything outside the band gets rejected.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {TESTS.map((t, i) => (
              <article key={t.name} className="rounded-2xl bg-ng-paper border border-ng-line-soft p-6 flex gap-5">
                <div className="font-display text-[28px] text-ng-clay leading-none shrink-0 w-10">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-[18px] text-ng-forest-deep">{t.name}</h3>
                  <p className="text-[13px] text-ng-ink-muted mt-2">{t.limit}</p>
                  <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mt-3 font-mono">{t.method}</div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Lab partners */}
        <div className="mb-20 rounded-3xl bg-ng-sage/30 border border-ng-line p-8 md:p-12">
          <span className="ng-eyebrow">Our lab partners</span>
          <h2 className="font-display text-[clamp(26px,3.4vw,36px)] text-ng-forest-deep mt-3 leading-tight max-w-2xl">
            Three independent labs verify every claim we make on the jar.
          </h2>

          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {PARTNERS.map((p) => (
              <div key={p.name} className="rounded-2xl bg-ng-paper border border-ng-line-soft p-6">
                <h3 className="font-display text-[18px] text-ng-forest-deep leading-tight">{p.name}</h3>
                <p className="text-[13px] text-ng-ink-muted mt-3">{p.role}</p>
                <div className="mt-5 pt-4 border-t border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-forest font-mono">
                  {p.accred}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sample reports */}
        <div className="mb-20">
          <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
            <div>
              <span className="ng-eyebrow">Recent lab reports</span>
              <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mt-3 leading-tight">
                Look under the hood.
              </h2>
            </div>
            <Link href="/traceability" className="text-[13px] text-ng-forest font-medium hover:underline">
              Trace any lot code →
            </Link>
          </div>

          <div className="rounded-3xl bg-ng-paper border border-ng-line-soft overflow-hidden">
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-5 px-6 py-4 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-soft font-medium">
              <span>Lot</span>
              <span>Product</span>
              <span>Tested on</span>
              <span>Partner</span>
              <span></span>
            </div>
            <ul>
              {SAMPLE_REPORTS.map((r) => (
                <li key={r.lot} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-5 px-6 py-5 items-center border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors">
                  <span className="font-mono text-[13px] text-ng-forest-deep">{r.lot}</span>
                  <span className="text-[14px] text-ng-ink">{r.product}</span>
                  <span className="text-[13px] text-ng-ink-muted">{r.date}</span>
                  <span className="text-[12px] text-ng-ink-muted">{r.partner}</span>
                  <button className="text-[12px] uppercase tracking-wider text-ng-forest font-bold hover:text-ng-leaf transition-colors">
                    PDF · {r.pages}p
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* If a lot fails */}
        <div className="grid lg:grid-cols-2 gap-10 items-center rounded-3xl bg-ng-forest-deep text-ng-cream p-8 md:p-12 overflow-hidden relative">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-ng-terracotta/20 blur-3xl" aria-hidden />
          <div className="relative">
            <span className="ng-eyebrow text-ng-clay">When a lot fails</span>
            <h2 className="font-display text-[clamp(26px,3.4vw,36px)] text-ng-cream mt-3 leading-tight">
              We name it on the journal. <em className="italic text-ng-clay">Every time.</em>
            </h2>
            <p className="text-[15px] text-ng-cream/70 mt-5 leading-relaxed max-w-md">
              In 2024 we rejected ₹14.2 lakh worth of inventory across 23 lots. The most common reason: moisture creep above 2% in groundnut after monsoon delays. We don't hide these — they're written up in our journal with the farmer's name and the resolution.
            </p>
            <Link href="/journal" className="inline-block mt-7 rounded-full bg-ng-clay text-ng-forest-deep font-semibold px-6 py-3 text-[14px] hover:bg-ng-clay-deep transition-colors">
              Read the rejection journal →
            </Link>
          </div>
          <div className="relative grid grid-cols-2 gap-4">
            <Tile big="23" small="Lots rejected in 2024" />
            <Tile big="₹14.2L" small="Inventory cost absorbed" />
            <Tile big="100%" small="Failure reasons published" />
            <Tile big="0" small="Sold-and-recalled events" />
          </div>
        </div>
      </Section>
    </PageShell>
  );
}

function Tile({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-2xl bg-ng-cream/10 border border-ng-cream/20 p-6">
      <div className="font-display text-[40px] text-ng-clay leading-none">{big}</div>
      <div className="text-[11px] uppercase tracking-wider text-ng-cream/60 mt-3">{small}</div>
    </div>
  );
}
