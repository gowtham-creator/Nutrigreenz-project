import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "Our story — Nutri Greenz",
  description:
    "Nutri Greenz is a Hyderabad farm-to-table brand sourcing direct from 42 partner farms. Read our mission, our sourcing model and the traceability ethos behind every lot.",
};

const STATS = [
  { value: "42", label: "Partner farms" },
  { value: "5", label: "Indian states sourced" },
  { value: "100%", label: "Lots lab-tested" },
  { value: "2019", label: "Sowing our first season" },
];

const PILLARS = [
  {
    icon: "leaf-bold",
    title: "Source direct, never through a mandi",
    body: "We buy straight from named farmers and co-ops — no middle layers skimming the margin. The price you pay reaches the people who grew your food.",
  },
  {
    icon: "test-tube-bold",
    title: "Test every single lot",
    body: "Nothing reaches your kitchen untested. Each batch is screened for pesticide residue, aflatoxin, heavy metals and adulteration before it is allowed to ship.",
  },
  {
    icon: "magnifer-zoom-in-bold",
    title: "Show our work",
    body: "Every pack carries a lot code. Scan it and you see the farm, the harvest date and the lab report. Trust should be verifiable, not a slogan.",
  },
  {
    icon: "scale-bold",
    title: "Pay farmers fairly",
    body: "Long-term partnerships and transparent pricing mean our growers can plan, invest in better practices, and transition land away from monoculture.",
  },
];

const TIMELINE = [
  { year: "2019", title: "The first season", body: "We partnered with a single dryland groundnut farm in Anantapur and cold-pressed our first batch of oil for friends and family in Hyderabad." },
  { year: "2021", title: "From plot to pantry", body: "Demand outgrew the garage. We opened our Kukatpally hub, added A2 ghee from Junagadh and honey from the Nilgiris, and built our first lab-testing protocol." },
  { year: "2023", title: "Traceability by default", body: "Every lot got a scannable code tied to its farm and lab report. Transparency stopped being a feature and became the way we operate." },
  { year: "2026", title: "42 farms and counting", body: "Today we work with 42 partner farms across five states, delivering across Hyderabad on fixed slots — fresh, tested and fully traceable." },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero
        tint="story"
        eyebrow="Our story"
        title={
          <>
            Born in soil. <em className="italic text-ng-leaf">Built for trust.</em>
          </>
        }
        description="Nutri Greenz began with one farm, one press and one stubborn belief — that good food should be honest about where it comes from. Today we bring fully traceable produce from 42 partner farms to kitchens across Hyderabad."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href="/shop">Shop the pantry</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/farms">Meet the farms</Link>
          </Button>
        </div>
      </PageHero>

      {/* Stats */}
      <Section className="!py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-3xl overflow-hidden border border-ng-line-soft bg-ng-line-soft">
          {STATS.map((s) => (
            <Reveal key={s.label} className="h-full bg-ng-paper p-7 text-center">
              <div className="font-display text-[clamp(34px,5vw,52px)] leading-none text-ng-forest-deep">{s.value}</div>
              <div className="mt-2 text-[13px] uppercase tracking-wider text-ng-ink-muted">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Mission */}
      <Section
        eyebrow="Why we exist"
        heading={<>Food you can trace back to the hands that grew it</>}
        description="Most of what fills a supermarket shelf has travelled through so many hands that nobody can tell you where it really came from. We were tired of guessing — so we built the short, honest supply chain we wanted to buy from ourselves."
      >
        <div className="grid md:grid-cols-2 gap-5">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05} className="flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="h-12 w-12 rounded-xl bg-ng-leaf/15 ring-1 ring-inset ring-ng-forest/12 inline-flex items-center justify-center text-ng-forest-deep">
                <Icon name={p.icon} size={24} />
              </div>
              <h3 className="mt-5 font-display text-[21px] text-ng-forest-deep leading-snug">{p.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ng-ink-muted">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* The 42 farms / sourcing model */}
      <Section className="bg-ng-sage/25" eyebrow="The sourcing model" heading="42 farms, five states, one standard">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <Reveal className="flex flex-col gap-4 text-[16px] leading-relaxed text-ng-ink-muted max-w-xl">
            <p>
              We don&rsquo;t list a thousand SKUs from anonymous suppliers. We work with a small,
              carefully chosen network of <strong className="text-ng-ink font-semibold">42 partner farms and
              co-operatives</strong> — from the groundnut belt of Anantapur to A2 dairies in Junagadh
              and honey co-ops in the Nilgiris.
            </p>
            <p>
              Each partnership is long-term and direct. We agree fair, transparent prices before a
              season begins, so our farmers can plan, invest in regenerative practices, and move land
              away from chemical monoculture. When they do well, our shelves do well.
            </p>
            <p>
              Every farm is named on our{" "}
              <Link href="/farms" className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep">farms page</Link>
              {" "}— because &ldquo;locally sourced&rdquo; means nothing if we can&rsquo;t tell you whose
              soil it came from.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="rounded-3xl border border-ng-line-soft bg-ng-paper p-8">
            <h3 className="font-display text-[22px] text-ng-forest-deep">From farm to your door</h3>
            <ol className="mt-6 flex flex-col gap-5">
              {[
                { t: "Harvested to order", d: "Produce is picked, milled or churned against real demand — not stockpiled for months." },
                { t: "Tested before it ships", d: "Each lot is screened at NABL-accredited labs plus our in-house QC. If it fails, it never ships." },
                { t: "Coded for traceability", d: "Every pack gets a lot code linking it to its farm, harvest date and report." },
                { t: "Delivered fresh in Hyderabad", d: "Onto fixed morning and evening slots, straight from our Kukatpally hub." },
              ].map((step, i) => (
                <li key={step.t} className="flex gap-4">
                  <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-ng-forest text-ng-cream text-[13px] font-semibold inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-display text-[17px] text-ng-forest-deep leading-snug">{step.t}</div>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ng-ink-muted">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </Section>

      {/* Traceability ethos */}
      <Section
        eyebrow="The traceability ethos"
        heading="If we can't prove it, we don't claim it"
        description="Anyone can print &ldquo;natural&rdquo; on a label. We decided the only honest version of that promise is one you can check yourself."
      >
        <Reveal className="relative overflow-hidden rounded-3xl bg-ng-forest-deep text-ng-cream p-8 md:p-12">
          {/* On-theme depth so the dark ethos panel reads with dimension, not a
              flat green block — matching the traceability band. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 58% 70% at 92% 6%, rgba(102,191,115,0.16), transparent 60%), radial-gradient(ellipse 55% 60% at 4% 100%, rgba(76,175,80,0.10), transparent 62%)",
            }}
          />
          <div className="relative grid md:grid-cols-3 gap-8">
            {[
              { icon: "qr-code-bold", t: "Scan the code", d: "Every pack carries a unique lot code printed on the label." },
              { icon: "tractor-bold", t: "See the farm", d: "The code resolves to the exact farm, farmer and harvest date." },
              { icon: "document-text-bold", t: "Read the report", d: "Open the lab report for that lot — pesticide, aflatoxin, the lot." },
            ].map((b) => (
              <div key={b.t}>
                <Icon name={b.icon} size={28} className="text-ng-leaf" />
                <h3 className="mt-4 font-display text-[20px] text-ng-cream">{b.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ng-cream/70">{b.d}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-9">
            <Button asChild variant="gold" size="md">
              <Link href="/traceability">Try the traceability scanner</Link>
            </Button>
          </div>
        </Reveal>
      </Section>

      {/* Timeline */}
      <Section className="bg-ng-cream/50" eyebrow="How we grew" heading="From one farm to forty-two">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIMELINE.map((t, i) => (
            <Reveal key={t.year} delay={i * 0.06} className="relative h-full rounded-2xl border border-ng-line-soft bg-ng-paper p-6">
              <span aria-hidden className="mb-4 block h-1 w-8 rounded-full bg-ng-leaf" />
              <div className="font-display text-[28px] text-ng-forest leading-none">{t.year}</div>
              <h3 className="mt-3 font-display text-[18px] text-ng-forest-deep leading-snug">{t.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ng-ink-muted">{t.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="!pt-4">
        <Reveal className="rounded-3xl bg-ng-forest text-ng-cream p-10 md:p-14 text-center">
          <h2 className="font-display text-[clamp(26px,4vw,42px)] leading-tight">Taste the difference honesty makes</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ng-cream/75">
            Stock your pantry with produce you can trace back to the farm — delivered fresh across
            Hyderabad.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild variant="secondary" size="lg">
              <Link href="/shop">Start shopping</Link>
            </Button>
            <Button asChild variant="glass" size="lg">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </Reveal>
      </Section>
    </PageShell>
  );
}
