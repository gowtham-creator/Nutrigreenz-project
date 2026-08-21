"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Input } from "@/components/ng/input";
import { Button } from "@/components/ng/button";

/** The subset of a real farm the traceability showcase renders. */
export interface TraceFarm {
  id: string;
  name: string;
  region: string;
  hectares: number | null;
  partneredSince: string | null;
  story: string | null;
}

// The lot code, journey dates, and lab panels remain an illustrative sample —
// there is no per-lot ledger yet — but the "partner farm" card below is now
// driven by a real, DB-backed farm passed in from the server component.
const SAMPLE = {
  code: "ANT-24-051",
  product: "Cold-Pressed Groundnut Oil, 1L Glass",
  harvestedOn: "2026-03-04",
  pressedOn: "2026-04-18",
  testedOn: "2026-04-21",
  shippedOn: "2026-04-23",
  km: 1240,
  carbon: 1.8,
  tests: [
    { name: "Heavy metals (Pb, As, Cd, Hg)", result: "Within FSSAI limits", pass: true },
    { name: "Aflatoxin B1 / B2 / G1 / G2", result: "Not detected", pass: true },
    { name: "Pesticide residue (200 panel)", result: "Not detected", pass: true },
    { name: "Adulterants (palmolein, mineral oil)", result: "0%", pass: true },
    { name: "Free fatty acids (%)", result: "0.42%", pass: true },
    { name: "Peroxide value", result: "2.1 mEq/kg", pass: true },
  ],
};

export function TraceabilityView({ farm }: { farm: TraceFarm | null }) {
  const [code, setCode] = useState("");
  const [shown, setShown] = useState(false);

  const since = farm?.partneredSince ? new Date(farm.partneredSince).getFullYear() : null;

  return (
    <PageShell>
      <PageHero
        image="/images/traceability/traceability-hero.webp"
        tone="forest"
        eyebrow="Traceability is the product"
        title={<>Type a code. <em className="italic text-ng-leaf">See the farm.</em></>}
        description="Every Nutrigreenz product carries a six-character lot code on the back of the label or under the QR sticker. Type it below to see the full story. Farmer, harvest date, pressing, lab tests, and kilometres travelled."
      >
        <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
          <Input
            placeholder="e.g. ANT-24-051"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-ng-cream/10 text-ng-cream placeholder:text-ng-cream/40 border-ng-cream/20"
          />
          <Button variant="gold" onClick={() => setShown(true)}>Trace</Button>
        </div>
        <p className="text-[12px] text-ng-cream/50 mt-3">
          Demo:{" "}
          <button onClick={() => { setCode(SAMPLE.code); setShown(true); }} className="underline text-ng-clay">
            ANT-24-051
          </button>
        </p>
      </PageHero>

      {shown ? (
        <Section>
          <div className="rounded-3xl bg-ng-paper border border-ng-line-soft overflow-hidden">
            {/* Header */}
            <div className="bg-ng-forest-deep text-ng-cream p-7 md:p-9 grid md:grid-cols-[1fr_auto] gap-5 items-start">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-ng-clay font-semibold">Trace report</div>
                <div className="font-mono text-[28px] text-ng-cream mt-1">{SAMPLE.code}</div>
                <div className="font-display text-[22px] text-ng-cream/90 mt-3">{SAMPLE.product}</div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ng-success/20 text-ng-success text-[13px] font-semibold">
                <span className="h-2 w-2 rounded-full bg-ng-success animate-pulse" />
                All clear · ready to ship
              </div>
            </div>

            {/* Journey */}
            <div className="p-7 md:p-9">
              <h2 className="font-display text-[22px] text-ng-forest-deep mb-5">Journey · soil to shelf</h2>
              <ol className="relative grid grid-cols-1 md:grid-cols-4 gap-0 md:gap-6 mb-8">
                {[
                  { label: "Harvested", date: SAMPLE.harvestedOn, place: "Anantapur · 14ha · partner farm" },
                  { label: "Pressed", date: SAMPLE.pressedOn, place: "Hyderabad · cold-press · single pass" },
                  { label: "Lab tested", date: SAMPLE.testedOn, place: "Hyderabad · 12-panel certified lab" },
                  { label: "Shipped", date: SAMPLE.shippedOn, place: "Hyderabad hub → customer" },
                ].map((step, i) => (
                  <li key={step.label} className="relative">
                    <div className="flex md:block items-center gap-4 md:gap-0">
                      <div className="h-10 w-10 rounded-full bg-ng-forest text-ng-cream grid place-items-center font-display text-[14px] shrink-0">
                        {i + 1}
                      </div>
                      <div className="md:mt-4">
                        <div className="font-display text-[16px] text-ng-forest-deep">{step.label}</div>
                        <div className="text-[12px] text-ng-ink-muted mt-0.5">
                          {new Date(step.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                        <div className="text-[12px] text-ng-ink-soft mt-1 md:max-w-[180px] leading-snug">{step.place}</div>
                      </div>
                    </div>
                    {i < 3 ? (
                      <div className="hidden md:block absolute top-5 left-12 right-0 h-px border-t border-dashed border-ng-line" />
                    ) : null}
                  </li>
                ))}
              </ol>

              {/* Farm card — real, DB-backed partner farm */}
              {farm ? (
                <div className="rounded-2xl bg-ng-cream-deep border border-ng-line p-6 md:p-7 grid md:grid-cols-[1fr_auto] gap-6 items-center mb-8">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ng-forest font-semibold">Partner farm</div>
                    <h3 className="font-display text-[24px] text-ng-forest-deep mt-1">{farm.name}</h3>
                    <p className="text-[14px] text-ng-ink-muted mt-2">
                      {farm.region}
                      {farm.hectares ? ` · ${farm.hectares} ha` : ""}
                      {since ? ` · partner since ${since}` : ""}
                    </p>
                    {farm.story ? (
                      <p className="text-[14px] text-ng-ink-muted mt-3 max-w-md leading-relaxed">{farm.story}</p>
                    ) : null}
                  </div>
                  <Link href={`/farms/${farm.id}`}>
                    <Button variant="primary">Visit farm →</Button>
                  </Link>
                </div>
              ) : null}

              {/* Tests grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-[20px] text-ng-forest-deep">Lab report — all twelve panels</h3>
                  <span className="text-[12px] text-ng-ink-soft">Tested by Hyderabad Analytics Lab · NABL-accredited</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {SAMPLE.tests.map((t) => (
                    <div key={t.name} className="h-full rounded-xl border border-ng-line-soft p-4 flex items-start gap-3">
                      <div className={`h-7 w-7 rounded-full grid place-items-center text-[12px] shrink-0 ${
                        t.pass ? "bg-ng-success/15 text-ng-success" : "bg-ng-danger/15 text-ng-danger"
                      }`}>
                        ✓
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-ng-ink">{t.name}</div>
                        <div className="text-[12px] text-ng-ink-muted mt-0.5">{t.result}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carbon & distance */}
              <div className="mt-8 grid sm:grid-cols-3 gap-3">
                <Tile big={`${SAMPLE.km} km`} small="From soil to your kitchen" />
                <Tile big={`${SAMPLE.carbon} kg CO₂e`} small="Per liter shipped (avg)" />
                <Tile big="100%" small="Plastic-free packaging" />
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {/* How it works */}
      <Section className="bg-ng-cream-mesh bg-ng-cream" eyebrow="How traceability works" heading={<>Six letters. <em className="italic text-ng-leaf">A full chain of custody.</em></>}>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "01", title: "Every lot gets a code", body: "When a farm delivers a batch, we assign a six-character code (region · year · lot)." },
            { n: "02", title: "Stamped on every label", body: "The code is printed on the back label and encoded in the QR sticker. It's machine-readable and human-readable." },
            { n: "03", title: "Tied to a public ledger", body: "Each event in the lot's life (harvest, press, test, ship) is anchored to a tamper-evident ledger. We can't quietly change history." },
          ].map((s) => (
            <article key={s.n} className="h-full rounded-3xl bg-ng-paper border border-ng-line-soft p-7">
              <div className="font-display text-[40px] leading-none text-ng-clay/60">{s.n}</div>
              <h3 className="font-display text-[20px] text-ng-forest-deep mt-3">{s.title}</h3>
              <p className="text-[14px] text-ng-ink-muted mt-2 leading-relaxed">{s.body}</p>
            </article>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function Tile({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-2xl bg-ng-sage/40 p-5">
      <div className="font-display text-[24px] text-ng-forest-deep leading-none">{big}</div>
      <div className="text-[12px] text-ng-ink-muted mt-2">{small}</div>
    </div>
  );
}
