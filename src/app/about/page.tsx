import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Button } from "@/components/ng/button";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { IndiaFlag } from "@/components/ui/india-flag";

export const metadata: Metadata = {
  title: "Our story · Nutri Greenz",
  description:
    "Nutri Greenz Farm Technologies Pvt. Ltd is a Hyderabad-based organic produce brand delivering non-adulterated food direct from farmers. Read our story, vision, mission and the people behind it.",
};

/*
 * Solar stand-ins were doing duty here for ideas none of them described: a
 * leaf for soil, a globe for sustainable farming, a shield-tick for customers
 * and a star for the nation. Four generic marks where four specific ones exist.
 *
 * `flag` is its own kind rather than another icon name because the tricolour
 * cannot be a `currentColor` mask — rendered in one colour it is three
 * identical stripes, not a flag. See `IndiaFlag`.
 */
const VISION_PILLARS: Array<
  { label: string } & ({ kind: "icon"; icon: UiIconName } | { kind: "flag" })
> = [
  { kind: "icon", icon: "soil", label: "Healthy soil" },
  { kind: "icon", icon: "farmhouse", label: "Sustainable farming" },
  { kind: "icon", icon: "customers", label: "Healthy customers" },
  { kind: "flag", label: "Healthy nation" },
];

const FOUNDERS = [
  {
    name: "RamaKrishna Katakam",
    role: "Founder",
    initials: "RK",
    body: "I've been working as a technocrat for roughly 20 years now. I come from a very humble family whose primary background was farming. I worked as a farmer and worked hard to study to become who I am today. I've been very passionate about farming since my childhood and I know the various challenges faced by today's farmers. At the bottom of my heart, I'm still that young farmer who's striving to take farming to the next level. Nutri Greenz Farm Technologies Pvt. Ltd is a brand looking forward to providing the farmer's produce directly to the customers, eliminating the middleman. Our vision is to change a food industry where today's food is produced using many chemicals that harm us and lead to various diseases. Organic food plays a big part in keeping us healthy.",
  },
  {
    name: "Surendra Madivada",
    role: "Founder · Natural & organic farming",
    initials: "SM",
    body: "Born and brought up in Hyderabad, Surendra completed his BTech in Hyderabad, pursued a Master of Science in the United Kingdom, and was a former student of the United Nations University in Tokyo. With over 8 years of experience in natural organic farming and a farming family background, he initiated natural organic farming in a village and motivated numerous farmers across Andhra Pradesh, Telangana and Karnataka to adopt the practice. Specializing in indigenous paddy varieties, he advises farmers on the right varieties for their soil, land and area. He is also a government-certified beekeeper and talks to farmers about how much pollination depends on bees. Guided by the spirit of “Jai Jawan, Jai Kisan”.",
  },
];

const TEAM = [
  {
    name: "Akhil Panja",
    role: "Agri-export & corporate farming",
    initials: "AP",
    body: "Panja Narayana Akhil, from Tadepalligudem, West Godavari district, Andhra Pradesh, holds a B.Tech in Computer Science and Engineering from Bangalore. For the past three years he has been actively involved in the agri-export business, with his forefathers having a long-standing history of agri-trading. He is particularly passionate about agriculture and practises corporate farming in an organic manner.",
  },
  {
    name: "Sudhakar Manchala",
    role: "Packaging & supply chain",
    initials: "SM",
    body: "Venkata Sudhakar Manchala, from Kakinada, East Godavari district, Andhra Pradesh, holds a Post Graduate degree in Polymer Engineering and an MBA in Marketing. After seven years in multinational corporations, he ventured into entrepreneurship in 2001, building his own plastic engineering and packaging business. He is a board member of the Indian Institute of Packaging and treasurer of the Indian Plastic Institute's Hyderabad chapter, and brings his passion for agriculture and the food supply chain to Nutrigreenz.",
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHero
        tone="forest"
        serifTitle
        image="/images/about/about-hero.webp"
        eyebrow="Our story"
        title={
          <>
            Non-adulterated food, <em className="italic text-ng-leaf">direct from the farmer.</em>
          </>
        }
        description="We come from organic farming, software engineering, packaging and exports. We started Nutri Greenz to get organic farmers a fair price and to bring their non-adulterated harvest straight to your door."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="primary" size="lg" className="!bg-ng-cream !text-ng-forest-deep hover:!bg-white">
            <Link href="/shop">Shop the pantry</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="!border-ng-cream/60 !text-ng-cream hover:!bg-ng-cream/10">
            <Link href="/farms">Meet the farms</Link>
          </Button>
        </div>
      </PageHero>

      {/* Our story */}
      <Section eyebrow="Our story" heading="How Nutrigreenz began">
        <Reveal className="max-w-3xl flex flex-col gap-4 text-[16.5px] leading-relaxed text-ng-ink-muted">
          <p>
            {
              "We came together from different backgrounds to build a platform for organically grown produce. Many organic farmers have no way to market their harvest and rarely get a fair price for it, so we joined forces."
            }
          </p>
          <p>
            {
              "Each of us brought something different: organic farming, software engineering, packaging and exports. We split the roles between us and got to work, and the result is Nutri Greenz Farm Technologies Pvt. Ltd. Our mission is to give our customers healthy food and to support sustainable farming for the generations after us."
            }
          </p>
        </Reveal>
      </Section>

      {/* Our vision */}
      <Section
        className="bg-ng-sage/25"
        eyebrow="Our vision"
        heading="Preserve the soil, nourish the nation"
        description="We want to keep the soil healthy for future generations by farming chemical-free and sustainably alongside our fellow farmers, and to bring wholesome, nutritious food to our customers."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {VISION_PILLARS.map((p, i) => (
            <Reveal
              key={p.label}
              delay={i * 0.05}
              className="flex flex-col items-center gap-4 rounded-2xl border border-ng-line-soft bg-ng-paper p-7 text-center"
            >
              {/* No disc. A 26px mark inside a 48px tinted square is a container
                  competing with the drawing it holds, and at that size the
                  drawing is the smaller of the two — the eye lands on the box.
                  Drawn bare at 40px in ink instead.

                  The flag keeps a hairline, and only the flag: it is the one
                  mark here made of three pale bands, and without an edge the
                  white centre band bleeds into the card behind it. */}
              {p.kind === "flag" ? (
                <IndiaFlag size={28} className="rounded-[3px] ring-1 ring-ng-line" />
              ) : (
                <UiIcon name={p.icon} size={40} className="text-ng-forest-deep" />
              )}
              <span className="font-display text-[17px] text-ng-forest-deep leading-snug">{p.label}</span>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Our mission */}
      <Section
        eyebrow="Our mission"
        heading="Fair prices for farmers, healthy food for you"
      >
        <Reveal className="max-w-3xl flex flex-col gap-4 text-[16.5px] leading-relaxed text-ng-ink-muted">
          <p>
            {
              "We have farmed chemical-free for the past eight years. Working with fellow farmers in groups lets us get them fair prices for their harvests."
            }
          </p>
          <p>
            {
              "For you, that means healthy food you can order online and have delivered to your door. Next, we want to grow our network, bring in more farmers and convert more farmland to organic."
            }
          </p>
        </Reveal>
      </Section>

      {/* Founders */}
      <Section className="bg-ng-cream/50" eyebrow="Our founders" heading="The people who started it">
        <div className="grid md:grid-cols-2 gap-6">
          {FOUNDERS.map((f, i) => (
            <Reveal key={f.name} delay={i * 0.06} className="flex h-full flex-col rounded-3xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="flex items-center gap-4">
                <span className="h-14 w-14 shrink-0 rounded-full bg-ng-forest text-ng-cream inline-flex items-center justify-center font-display text-[18px]">
                  {f.initials}
                </span>
                <div>
                  <h3 className="font-display text-[20px] text-ng-forest-deep leading-snug">{f.name}</h3>
                  <p className="text-[13px] uppercase tracking-wider text-ng-ink-muted">{f.role}</p>
                </div>
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-ng-ink-muted">{f.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Team */}
      <Section eyebrow="Our team" heading="The hands behind the harvest">
        <div className="grid md:grid-cols-2 gap-6">
          {TEAM.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06} className="flex h-full flex-col rounded-3xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="flex items-center gap-4">
                <span className="h-14 w-14 shrink-0 rounded-full bg-ng-leaf/20 text-ng-forest-deep inline-flex items-center justify-center font-display text-[18px]">
                  {t.initials}
                </span>
                <div>
                  <h3 className="font-display text-[20px] text-ng-forest-deep leading-snug">{t.name}</h3>
                  <p className="text-[13px] uppercase tracking-wider text-ng-ink-muted">{t.role}</p>
                </div>
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-ng-ink-muted">{t.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="!pt-4">
        <Reveal className="rounded-3xl bg-ng-forest text-ng-cream p-10 md:p-14 text-center">
          <h2 className="font-display text-[clamp(26px,4vw,42px)] leading-tight">Taste the difference honesty makes</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ng-cream/75">
            Stock your pantry with non-adulterated produce bought directly from farmers and delivered
            fresh across Hyderabad.
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
