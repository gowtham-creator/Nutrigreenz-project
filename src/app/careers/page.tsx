import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "Careers — Nutri Greenz",
  description:
    "Join Nutri Greenz in Hyderabad. We're a small farm-to-table team building an honest, fully traceable food supply chain. See our culture and open roles.",
};

const VALUES = [
  { icon: "leaf-bold", title: "Soil before slogans", body: "We&rsquo;d rather show the lab report than write a clever tagline. Substance wins here." },
  { icon: "users-group-rounded-bold", title: "Farmers are partners", body: "Our growers aren&rsquo;t a line item. Fair, long-term relationships shape every decision we make." },
  { icon: "test-tube-bold", title: "Earn trust daily", body: "Traceability is hard work, every lot, every day. We sweat the details so customers don&rsquo;t have to." },
  { icon: "bolt-bold", title: "Small team, real ownership", body: "You&rsquo;ll own outcomes, not tickets. Ideas matter more than hierarchy." },
];

const PERKS = [
  "Fresh Nutri Greenz produce on the house",
  "Health cover for you and your family",
  "Learning budget and farm-visit days",
  "Flexible hours with a Kukatpally home base",
];

const ROLES = [
  {
    title: "Supply Chain Associate",
    team: "Operations",
    location: "Kukatpally, Hyderabad · On-site",
    type: "Full-time",
    blurb: "Own farm coordination, intake and cold-chain dispatch. You&rsquo;ll be the link between our 42 partner farms and the city.",
  },
  {
    title: "Frontend Engineer (React / Next.js)",
    team: "Product & Engineering",
    location: "Hyderabad · Hybrid",
    type: "Full-time",
    blurb: "Build the storefront and traceability experience. TypeScript, Next.js App Router, an eye for craft and a love of fast, accessible UI.",
  },
  {
    title: "Quality & Lab Coordinator",
    team: "Quality",
    location: "Hyderabad · On-site",
    type: "Full-time",
    blurb: "Run our lot-testing protocol end to end — coordinate NABL labs, log reports, and make the no-compromise call on what ships.",
  },
  {
    title: "Customer Experience Lead",
    team: "Support",
    location: "Hyderabad · Hybrid",
    type: "Full-time",
    blurb: "Be the warm, fast voice customers remember — own support, returns and delight across chat, email and phone.",
  },
  {
    title: "Delivery Captain",
    team: "Last mile",
    location: "Across Hyderabad · Field",
    type: "Full-time / Part-time",
    blurb: "Bring fresh boxes to doors on morning and evening slots. A friendly face and careful hands for our cold-chain.",
  },
];

export default function CareersPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Careers"
        title={
          <>
            Grow something <em className="italic text-ng-leaf">honest</em> with us
          </>
        }
        description="We're a small, stubborn team in Hyderabad building an honest, fully traceable food supply chain — from 42 partner farms to kitchens across the city. If that fires you up, we should talk."
      />

      {/* Culture */}
      <Section eyebrow="How we work" heading="A team that sweats the details">
        <div className="grid sm:grid-cols-2 gap-5">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.05} className="rounded-2xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="h-12 w-12 rounded-xl bg-ng-sage/50 inline-flex items-center justify-center text-ng-forest-deep">
                <Icon name={v.icon} size={24} />
              </div>
              <h3 className="mt-5 font-display text-[20px] text-ng-forest-deep">{v.title}</h3>
              <p
                className="mt-2.5 text-[15px] leading-relaxed text-ng-ink-muted"
                dangerouslySetInnerHTML={{ __html: v.body }}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Perks */}
      <Section className="bg-ng-sage/25 !py-16" eyebrow="What we offer" heading="The good stuff">
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
          {PERKS.map((p) => (
            <Reveal key={p} className="flex items-center gap-3 rounded-xl bg-ng-paper border border-ng-line-soft px-5 py-4">
              <span className="h-7 w-7 shrink-0 rounded-full bg-ng-forest text-ng-cream inline-flex items-center justify-center">
                <Icon name="check-circle-bold" size={16} />
              </span>
              <span className="text-[15px] text-ng-ink">{p}</span>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Open roles */}
      <Section eyebrow="Open roles" heading="Where you fit in" id="openings">
        <div className="flex flex-col gap-4">
          {ROLES.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.04}>
              <div className="group rounded-2xl border border-ng-line-soft bg-ng-paper p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5 hover:border-ng-leaf transition-colors">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-[21px] text-ng-forest-deep leading-snug">{r.title}</h3>
                    <span className="text-[11.5px] uppercase tracking-wider rounded-full bg-ng-sage/60 text-ng-forest-deep px-2.5 py-1">{r.team}</span>
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ng-ink-muted max-w-2xl"
                     dangerouslySetInnerHTML={{ __html: r.blurb }} />
                  <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-ng-ink-soft">
                    <span className="inline-flex items-center gap-1.5"><Icon name="map-point-linear" size={15} />{r.location}</span>
                    <span className="inline-flex items-center gap-1.5"><Icon name="clock-circle-linear" size={15} />{r.type}</span>
                  </div>
                </div>
                <a
                  href={`mailto:careers@nutrigreenz.in?subject=${encodeURIComponent(`Application: ${r.title}`)}`}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full bg-ng-forest text-ng-paper font-semibold px-6 py-3 text-[14px] hover:bg-ng-forest-deep transition-colors"
                >
                  Apply
                  <Icon name="arrow-right-linear" size={16} />
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 rounded-2xl border border-dashed border-ng-line bg-ng-cream/40 p-7 text-center">
          <h3 className="font-display text-[20px] text-ng-forest-deep">Don&rsquo;t see your role?</h3>
          <p className="mx-auto mt-2 max-w-lg text-[15px] text-ng-ink-muted">
            We&rsquo;re always glad to meet good people who care about honest food. Send us a note and
            tell us how you&rsquo;d like to help.
          </p>
          <a
            href="mailto:careers@nutrigreenz.in?subject=Open%20application"
            className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-ng-forest text-ng-forest font-semibold px-6 py-2.5 text-[14px] hover:bg-ng-forest hover:text-ng-paper transition-colors"
          >
            Write to careers@nutrigreenz.in
          </a>
        </Reveal>
      </Section>

      {/* CTA */}
      <Section className="!pt-4">
        <Reveal className="rounded-3xl bg-ng-forest-deep text-ng-cream p-10 md:p-12 text-center">
          <h2 className="font-display text-[clamp(24px,3.6vw,38px)] leading-tight">Curious about the work behind the label?</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-ng-cream/75">
            Read our story, meet the farms, and see why traceability is the whole point.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/about" className="inline-flex items-center gap-2 rounded-full bg-ng-clay text-ng-soil font-semibold px-6 py-3 text-[14px] hover:bg-ng-clay-deep hover:text-ng-paper transition-colors">Our story</Link>
            <Link href="/farms" className="inline-flex items-center gap-2 rounded-full glass-strong text-ng-cream font-semibold px-6 py-3 text-[14px]">Meet the farms</Link>
          </div>
        </Reveal>
      </Section>
    </PageShell>
  );
}
