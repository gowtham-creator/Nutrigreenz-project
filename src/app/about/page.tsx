import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Button } from "@/components/ng/button";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { IndiaFlag } from "@/components/ui/india-flag";
import { BRAND, pageMeta } from "@/lib/seo";
import { AnswerBlock } from "@/components/ng/answer-block";

export const metadata: Metadata = pageMeta({
  title: "Our story · Nutri Greenz",
  description: "Nutri Greenz is a Hyderabad brand selling cold-pressed oils, ghee and raw honey direct from partner farms. Read how we began, how we make and test every lot, and what we promise.",
  path: "/about",
});

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

/** At a glance: every figure here is stated elsewhere on the site. */
const GLANCE = [
  { value: "8+ years", label: "farming chemical-free" },
  { value: "3", label: "ranges: oils, ghee, honey" },
  { value: "Every lot", label: "lab-tested before it ships" },
  { value: "Hyderabad", label: "delivered to your door" },
];

const RANGES: { title: string; body: string; href: string; cta: string; icon: UiIconName }[] = [
  {
    title: "Cold-pressed oils",
    body: "Groundnut, sesame, safflower, mustard, coconut and more, pressed slowly from whole seed. Never refined, bleached or hexane-extracted.",
    href: "/shop/oils",
    cta: "Shop oils",
    icon: "leaf",
  },
  {
    title: "A2 & bilona ghee",
    body: "Churned from curd the traditional bilona way, from desi cow milk. No skimming, no foreign fats, no preservatives.",
    href: "/shop/ghee",
    cta: "Shop ghee",
    icon: "farmhouse",
  },
  {
    title: "Raw honey",
    body: "Unprocessed honey from partner beekeepers, bottled as it comes from the hive. Not heated, not blended, not sweetened.",
    href: "/shop/honey",
    cta: "Shop honey",
    icon: "bee",
  },
];

/** Farm to door, in the order it happens. */
const JOURNEY: { step: string; title: string; body: string; href?: string; cta?: string }[] = [
  { step: "01", title: "Grown by partner farmers", body: "Chemical-free farmers we buy from directly, at a fair price, with no traders in between." },
  { step: "02", title: "Pressed and churned in small batches", body: "Oils are cold-pressed and ghee is bilona-churned in small runs, so nothing sits in a warehouse for months." },
  { step: "03", title: "Tested, lot by lot", body: "Every lot is checked for purity, pesticide residue and heavy metals. If a check fails, the lot does not ship.", href: "/lab", cta: "See the lab reports" },
  { step: "04", title: "Traceable to the farm", body: "Each bottle carries a lot code. Enter it to see the farm, the harvest, the pressing and the lab results behind it.", href: "/traceability", cta: "Trace a lot" },
  { step: "05", title: "Delivered to your door", body: "Packed fresh and delivered across Hyderabad in the slot you choose, or on a schedule with Subscribe & save.", href: "/shop", cta: "Shop now" },
];

const PROMISES: { title: string; body: string; icon: UiIconName }[] = [
  { icon: "verified", title: "Nothing added, nothing removed", body: "No adulteration, no preservatives, no refining. What the farm grew is what you get." },
  { icon: "customers", title: "A fair price for farmers", body: "Buying direct means more of what you pay reaches the people who grew it." },
  { icon: "certificate", title: "Proof, not promises", body: "Lab reports and lot codes are public, so you can check every claim on this page yourself." },
  { icon: "shipping", title: "Licensed and accountable", body: "An FSSAI-licensed company you can reach by phone, email or at our Hyderabad office." },
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

      {/* Who we are, in facts — the passage search engines and AI assistants quote */}
      <Section className="!pb-0">
        <AnswerBlock
          question="What is Nutri Greenz?"
          answer={`${BRAND.summary} The company behind it is ${BRAND.legalName}, registered in Telangana. ${BRAND.disambiguation}`}
          facts={[
            { label: "Brand", value: "Nutri Greenz (also written NutriGreenz)" },
            { label: "Company", value: BRAND.legalName },
            { label: "CIN", value: BRAND.cin },
            { label: "GSTIN", value: BRAND.gstin },
            ...(BRAND.fssai ? [{ label: "FSSAI licence", value: BRAND.fssai }] : []),
            { label: "We sell", value: "Cold-pressed oils, A2 and bilona ghee, raw honey", href: "/shop" },
            { label: "Office", value: "Prashanth Nagar, Kukatpally, Hyderabad, Telangana 500072" },
            { label: "Delivery", value: "Across Hyderabad" },
            { label: "Contact", value: `${BRAND.telephone} · ${BRAND.email}`, href: "/contact" },
          ]}
        />
      </Section>

      {/* At a glance */}
      <Section className="!pb-0">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-ng-line-soft bg-ng-line-soft md:grid-cols-4">
          {GLANCE.map((g, i) => (
            <Reveal key={g.label} delay={i * 0.05} className="flex flex-col gap-1 bg-ng-paper px-5 py-7 text-center sm:px-6">
              <span className="font-display text-[clamp(24px,3.2vw,34px)] leading-none text-ng-forest-deep">{g.value}</span>
              <span className="text-[13px] leading-snug text-ng-ink-muted">{g.label}</span>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Our story */}
      <Section eyebrow="Our story" heading="How Nutri Greenz began">
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

      {/* What we make */}
      <Section eyebrow="What we make" heading="Three things, done properly">
        <div className="grid gap-5 md:grid-cols-3">
          {RANGES.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.06} className="h-full">
              <Link
                href={r.href}
                className="group flex h-full flex-col rounded-3xl border border-ng-line-soft bg-ng-paper p-7 shadow-[var(--shadow-ng-card)] transition-shadow hover:shadow-[var(--shadow-ng-float)]"
              >
                <UiIcon name={r.icon} size={36} className="text-ng-forest-deep" />
                <h3 className="mt-5 font-display text-[22px] leading-snug text-ng-forest-deep">{r.title}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ng-ink-muted">{r.body}</p>
                <span className="mt-5 text-[13.5px] font-semibold text-ng-forest transition-colors group-hover:text-ng-forest-deep">
                  {r.cta} →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Farm to door */}
      <Section
        // `isolate` keeps the photo layer (-z-10) above the section's own
        // background but under the heading and cards.
        className="isolate overflow-hidden bg-ng-forest-deep text-ng-cream"
        eyebrow="How it reaches you"
        heading={<span className="text-ng-cream">From the farm to your kitchen</span>}
      >
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image
            src="/images/farms/farms-hero.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[center_35%] opacity-70"
          />
          {/* Darkest behind the heading and the cards' text, letting the
              golden field show through at the top right. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep via-ng-forest-deep/75 to-ng-forest-deep/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-ng-forest-deep/85 via-ng-forest-deep/30 to-transparent" />
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY.map((j, i) => (
            <Reveal as="li" key={j.step} delay={i * 0.05} className="flex h-full flex-col rounded-2xl border border-ng-cream/15 bg-ng-forest-deep/55 p-6 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <span className="font-mono text-[12px] font-semibold tracking-widest text-ng-leaf">{j.step}</span>
              <h3 className="mt-3 font-display text-[19px] leading-snug text-ng-cream">{j.title}</h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ng-cream/70">{j.body}</p>
              {j.href ? (
                <Link href={j.href} className="mt-4 text-[13px] font-semibold text-ng-leaf transition-colors hover:text-ng-cream">
                  {j.cta} →
                </Link>
              ) : null}
            </Reveal>
          ))}
        </ol>
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

      {/* Promises */}
      <Section className="bg-ng-sage/25" eyebrow="Our promises" heading="What you can hold us to">
        <div className="grid gap-5 sm:grid-cols-2">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05} className="flex gap-4 rounded-3xl border border-ng-line-soft bg-ng-paper p-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ng-cream text-ng-forest-deep">
                <UiIcon name={p.icon} size={24} />
              </span>
              <div>
                <h3 className="font-display text-[19px] leading-snug text-ng-forest-deep">{p.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ng-ink-muted">{p.body}</p>
              </div>
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
