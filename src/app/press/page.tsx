import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "Press & media — Nutri Greenz",
  description:
    "Press resources for Nutri Greenz, the Hyderabad farm-to-table brand. Media kit, brand facts, recent mentions and a press contact.",
};

const FACTS = [
  { label: "Founded", value: "2019, Hyderabad" },
  { label: "Partner farms", value: "42 across 5 states" },
  { label: "Lots lab-tested", value: "100%" },
  { label: "Delivery", value: "Across Hyderabad, fixed slots" },
];

const MENTIONS = [
  {
    outlet: "The Hindu — MetroPlus",
    title: "The Hyderabad brand that lets you scan your ghee back to the cow",
    quote: "Nutri Greenz has turned traceability from marketing jargon into something you can actually check on your phone.",
    date: "March 2026",
  },
  {
    outlet: "YourStory",
    title: "How a single groundnut farm grew into a 42-farm network",
    quote: "A patient, farmer-first model that proves transparency and good business aren&rsquo;t at odds.",
    date: "January 2026",
  },
  {
    outlet: "Telangana Today",
    title: "Farm-to-table, done the hard way",
    quote: "Every lot tested, every farm named — Nutri Greenz is setting a quietly high bar for clean-label food in the city.",
    date: "November 2025",
  },
];

const KIT = [
  { icon: "gallery-bold", title: "Logos & brand marks", note: "SVG and PNG, light and dark." },
  { icon: "palette-bold", title: "Brand guidelines", note: "Colour, type and voice in brief." },
  { icon: "camera-bold", title: "Product & farm photography", note: "High-resolution, press-cleared." },
];

export default function PressPage() {
  return (
    <PageShell>
      <PageHero
        tone="forest"
        eyebrow="Press & media"
        title={
          <>
            The story behind <em className="italic text-ng-clay">the label</em>
          </>
        }
        description="Nutri Greenz is a Hyderabad farm-to-table brand building a fully traceable food supply chain — from 42 partner farms to kitchens across the city. Resources for journalists and partners are below."
      >
        <a
          href="mailto:press@nutrigreenz.in?subject=Press%20enquiry"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-ng-clay text-ng-soil font-semibold px-6 py-3 text-[14px] hover:bg-ng-clay-deep hover:text-ng-paper transition-colors"
        >
          <Icon name="letter-bold" size={17} />
          press@nutrigreenz.in
        </a>
      </PageHero>

      {/* Brand facts */}
      <Section className="!py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-3xl overflow-hidden border border-ng-line-soft bg-ng-line-soft">
          {FACTS.map((f) => (
            <Reveal key={f.label} className="bg-ng-paper p-7">
              <div className="text-[12px] uppercase tracking-wider text-ng-ink-muted">{f.label}</div>
              <div className="mt-1.5 font-display text-[20px] leading-snug text-ng-forest-deep">{f.value}</div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Boilerplate */}
      <Section
        className="!pt-4"
        eyebrow="About Nutri Greenz"
        heading="The short version, for your copy desk"
      >
        <Reveal className="max-w-2xl flex flex-col gap-4 text-[16px] leading-relaxed text-ng-ink-muted">
          <p>
            <strong className="text-ng-ink font-semibold">Nutri Greenz</strong> is a farm-to-table
            food brand based in Hyderabad. Since 2019 it has sourced directly from a network of 42
            partner farms and co-operatives across five Indian states — cold-pressed oils, A2 ghee, raw
            honey, millets, stone-ground flours and seasonal produce.
          </p>
          <p>
            Every lot is lab-tested for pesticide residue, aflatoxin, heavy metals and adulteration
            before it ships, and carries a scannable lot code that traces it back to the farm, the
            harvest date and the lab report. Nutri Greenz delivers across Hyderabad on fixed morning and
            evening slots.
          </p>
        </Reveal>
      </Section>

      {/* Mentions */}
      <Section className="bg-ng-sage/25" eyebrow="In the press" heading="Recent mentions">
        <div className="grid md:grid-cols-3 gap-5">
          {MENTIONS.map((m, i) => (
            <Reveal key={m.title} delay={i * 0.05} className="flex flex-col rounded-2xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ng-forest">{m.outlet}</span>
                <span className="text-[12px] text-ng-ink-soft">{m.date}</span>
              </div>
              <h3 className="mt-3 font-display text-[18px] leading-snug text-ng-forest-deep">{m.title}</h3>
              <p
                className="mt-3 text-[14.5px] leading-relaxed text-ng-ink-muted italic"
                dangerouslySetInnerHTML={{ __html: `&ldquo;${m.quote}&rdquo;` }}
              />
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-[13px] text-ng-ink-soft">
          Quotes are illustrative of coverage themes. For interviews, data or a founder conversation,
          email{" "}
          <a href="mailto:press@nutrigreenz.in" className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep">
            press@nutrigreenz.in
          </a>
          .
        </p>
      </Section>

      {/* Media kit */}
      <Section eyebrow="Media kit" heading="Assets for your story">
        <div className="grid md:grid-cols-3 gap-5">
          {KIT.map((k, i) => (
            <Reveal key={k.title} delay={i * 0.05} className="rounded-2xl border border-ng-line-soft bg-ng-paper p-7">
              <div className="h-12 w-12 rounded-xl bg-ng-sage/50 inline-flex items-center justify-center text-ng-forest-deep">
                <Icon name={k.icon} size={24} />
              </div>
              <h3 className="mt-5 font-display text-[19px] text-ng-forest-deep">{k.title}</h3>
              <p className="mt-2 text-[14.5px] text-ng-ink-muted">{k.note}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 rounded-3xl bg-ng-forest-deep text-ng-cream p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-[24px] text-ng-cream">Need the full kit or a quote?</h2>
            <p className="mt-2 text-[15px] text-ng-cream/70 max-w-md">
              We&rsquo;ll send logos, photography and brand facts, and set up a conversation with the
              team.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a href="mailto:press@nutrigreenz.in?subject=Media%20kit%20request" className="inline-flex items-center gap-2 rounded-full bg-ng-clay text-ng-soil font-semibold px-6 py-3 text-[14px] hover:bg-ng-clay-deep hover:text-ng-paper transition-colors">Request media kit</a>
            <Link href="/about" className="inline-flex items-center gap-2 rounded-full glass-strong text-ng-cream font-semibold px-6 py-3 text-[14px]">Read our story</Link>
          </div>
        </Reveal>
      </Section>
    </PageShell>
  );
}
