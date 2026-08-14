import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";
import { AppIcon } from "@/components/ui/app-icon";

export const metadata: Metadata = {
  title: "Bulk & corporate · Nutri Greenz",
  description:
    "Buy Nutri Greenz in bulk or gift it at scale. Pantry supply for cafés and offices, curated corporate hampers and festival gifting: sourced direct, lab-tested, delivered across Hyderabad.",
};

const USE_CASES = [
  {
    icon: "shop-bold",
    title: "Cafés, cloud kitchens & restaurants",
    body: "Cold-pressed oils, A2 ghee and stone-ground flours in catering sizes: the same single-origin, lab-tested quality, at volume pricing.",
  },
  {
    icon: "buildings-2-bold",
    title: "Office pantries",
    body: "Stock your team kitchen with honest snacks, honey, millets and superfoods on a recurring schedule across Hyderabad.",
  },
  {
    icon: "gift-bold",
    title: "Corporate gifting",
    body: "Curated hampers for clients, employees and festivals. Co-branded and delivered to one address or many.",
  },
];

const STEPS = [
  { t: "Tell us what you need", d: "Share your products, volumes and how often, one-off or recurring." },
  { t: "Get a tailored quote", d: "We confirm availability from our partner farms and send transparent bulk pricing." },
  { t: "We deliver across Hyderabad", d: "Scheduled drops to your café, office or gifting list. Fresh and traceable as always." },
];

const PROOF = [
  { icon: "test-tube-bold", t: "Every lot lab-tested", d: "The same no-compromise quality as our retail shelf." },
  { icon: "leaf-bold", t: "Sourced direct from 42 farms", d: "No anonymous middle layer: named farms, fair prices." },
  { icon: "qr-code-bold", t: "Fully traceable", d: "Lot codes on every pack, even at volume." },
];

export default function WholesalePage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Bulk & corporate"
        title={
          <>
            Honest food, <em className="italic text-ng-leaf">at scale</em>
          </>
        }
        description="Whether you're stocking a café pantry, a 200-person office, or gifting clients this festive season. Get Nutri Greenz quality in bulk, sourced direct and delivered across Hyderabad."
      >
        <a
          href="mailto:wholesale@nutrigreenz.farm?subject=Bulk%20%26%20corporate%20enquiry"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-ng-clay text-ng-soil font-semibold px-6 py-3 text-[14px] hover:bg-ng-clay-deep hover:text-ng-paper transition-colors"
        >
          <AppIcon name="email" size={17} />
          Request a quote
        </a>
      </PageHero>

      {/* Use cases */}
      <Section eyebrow="Who it's for" heading="Built for cafés, offices and gifting">
        <div className="grid md:grid-cols-3 gap-5">
          {USE_CASES.map((u, i) => (
            <Reveal key={u.title} delay={i * 0.05} className="flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="h-12 w-12 rounded-xl bg-ng-cream inline-flex items-center justify-center text-ng-forest-deep">
                <Icon name={u.icon} size={24} />
              </div>
              <h3 className="mt-5 font-display text-[20px] text-ng-forest-deep leading-snug">{u.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ng-ink-muted">{u.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Why bulk with us */}
      <Section className="bg-ng-sage/25 !py-16" eyebrow="Why buy bulk from us" heading="Volume, without cutting corners">
        <div className="grid md:grid-cols-3 gap-5">
          {PROOF.map((p, i) => (
            <Reveal key={p.t} delay={i * 0.05} className="flex h-full gap-4 rounded-2xl bg-ng-paper border border-ng-line-soft p-6">
              <span className="h-11 w-11 shrink-0 rounded-xl bg-ng-forest text-ng-cream inline-flex items-center justify-center">
                <Icon name={p.icon} size={22} />
              </span>
              <div>
                <h3 className="font-display text-[18px] text-ng-forest-deep leading-snug">{p.t}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ng-ink-muted">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section eyebrow="How it works" heading="From enquiry to delivery in three steps">
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.06} className="flex h-full flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-7">
              <span className="h-9 w-9 rounded-full bg-ng-forest text-ng-cream text-[14px] font-semibold inline-flex items-center justify-center">{i + 1}</span>
              <h3 className="mt-4 font-display text-[19px] text-ng-forest-deep leading-snug">{s.t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ng-ink-muted">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="!pt-4">
        <Reveal className="rounded-3xl bg-ng-forest text-ng-cream p-10 md:p-14 text-center">
          <h2 className="font-display text-[clamp(26px,4vw,42px)] leading-tight">Let&rsquo;s talk volume</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ng-cream/75">
            Tell us what you need and we&rsquo;ll come back with availability and pricing — usually
            within one business day.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href="mailto:wholesale@nutrigreenz.farm?subject=Bulk%20%26%20corporate%20enquiry"
              className="inline-flex items-center gap-2 rounded-full bg-ng-clay text-ng-soil font-semibold px-6 py-3 text-[15px] hover:bg-ng-clay-deep hover:text-ng-paper transition-colors"
            >
              Email wholesale@nutrigreenz.farm
            </a>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full glass-strong text-ng-cream font-semibold px-6 py-3 text-[15px]">
              Contact the team
            </Link>
          </div>
        </Reveal>
      </Section>
    </PageShell>
  );
}
