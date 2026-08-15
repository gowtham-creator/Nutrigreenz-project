import Link from "next/link";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";

const ACTIVE_BUNDLES = [
  {
    slug: "madhapur-may-26",
    name: "Madhapur pod · May cycle",
    captain: "Sneha Kumar",
    cutoff: "22 May, 22:00",
    members: 28,
    target: 32,
    saved: 12,
    distance: "1.2 km from you",
  },
  {
    slug: "gachibowli-may-30",
    name: "Gachibowli pod · May cycle",
    captain: "Arjun D.",
    cutoff: "30 May, 22:00",
    members: 18,
    target: 25,
    saved: 8,
    distance: "4.8 km from you",
  },
];

const HOW = [
  { n: "01", t: "Join a pod near you", b: "Pods are run by a Nutrigreenz Captain. A vetted resident in your neighborhood who consolidates orders." },
  { n: "02", t: "Order from your pod's inventory", b: "Each pod gets a dedicated lot. Same lot, same quality, but 8–14% cheaper because of zero last-mile cost." },
  { n: "03", t: "Pick up from the Captain's home", b: "On cycle close day, walk to the Captain's address. No delivery slot to chase. No box waste." },
];

export default function CommunityBundleIndex() {
  return (
    <PageShell>
      <PageHero
        tone="forest"
        eyebrow="Community Bundle"
        title={<>Buy together. <em className="italic text-ng-clay">Pay less.</em> Waste nothing.</>}
        description="A neighborhood pod is 12–32 members ordering from the same lot, picked up from a vetted Captain near you. Saves 8–14%, and eliminates the last-mile cardboard."
      />

      <Section>
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-10 mb-16">
          <div>
            <span className="ng-eyebrow">Active near you</span>
            <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mt-3 leading-tight mb-7">
              Two pods <em className="italic text-ng-leaf">accepting orders</em> right now.
            </h2>
            <div className="space-y-4">
              {ACTIVE_BUNDLES.map((b) => {
                const pct = Math.min(100, (b.members / b.target) * 100);
                return (
                  <Link key={b.slug} href={`/community/bundle/inventory?pod=${b.slug}`} className="block rounded-3xl bg-ng-paper border border-ng-line-soft p-7 hover:shadow-[var(--shadow-ng-float)] transition-shadow">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-display text-[20px] text-ng-forest-deep">{b.name}</h3>
                        <div className="text-[12px] text-ng-ink-soft mt-1">Captain · {b.captain} · {b.distance}</div>
                      </div>
                      <span className="bg-ng-clay/30 text-ng-clay-deep px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold">
                        Save {b.saved}%
                      </span>
                    </div>
                    <div className="mb-1.5 flex justify-between text-[12px]">
                      <span className="text-ng-ink-muted">{b.members} of {b.target} members joined</span>
                      <span className="text-ng-forest font-semibold">Closes {b.cutoff}</span>
                    </div>
                    <div className="h-2 bg-ng-line-soft rounded-full overflow-hidden">
                      <div className="h-full bg-ng-forest rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-5 text-[13px] text-ng-forest font-medium">Browse pod inventory →</div>
                  </Link>
                );
              })}
            </div>
          </div>

          <aside className="rounded-3xl bg-ng-sage/30 border border-ng-line p-7 self-start lg:sticky lg:top-24">
            <h3 className="font-display text-[20px] text-ng-forest-deep">Become a Captain</h3>
            <p className="text-[14px] text-ng-ink-muted mt-3 leading-relaxed">
              Run a pod in your apartment, gated community, or co-working. Earn 10% commission. We handle inventory, billing, and logistics.
            </p>
            <ul className="mt-5 space-y-2.5 text-[13px] text-ng-ink-muted">
              <li className="flex gap-2"><span className="text-ng-forest">✓</span>10% commission on every pod cycle</li>
              <li className="flex gap-2"><span className="text-ng-forest">✓</span>PWA tool. Manage from your phone</li>
              <li className="flex gap-2"><span className="text-ng-forest">✓</span>No upfront cost, we deliver inventory</li>
              <li className="flex gap-2"><span className="text-ng-forest">✓</span>Train 1-on-1 with our community lead</li>
            </ul>
            <Link href="/auth?role=captain" className="block mt-6 text-center rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-6 py-3 text-[14px] hover:bg-ng-forest transition-colors">
              Apply to lead a pod →
            </Link>
          </aside>
        </div>

        {/* How it works */}
        <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-8 md:p-12">
          <span className="ng-eyebrow">How it works</span>
          <h2 className="font-display text-[clamp(26px,3.4vw,36px)] text-ng-forest-deep mt-3 leading-tight">
            Three steps. Saves both <em className="italic text-ng-leaf">money and packaging.</em>
          </h2>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {HOW.map((h) => (
              <article key={h.n} className="rounded-2xl bg-ng-cream p-6">
                <div className="font-display text-[44px] text-ng-clay leading-none">{h.n}</div>
                <h3 className="font-display text-[18px] text-ng-forest-deep mt-4">{h.t}</h3>
                <p className="text-[13.5px] text-ng-ink-muted mt-2 leading-relaxed">{h.b}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Impact tiles */}
        <div className="grid md:grid-cols-4 gap-4 mt-16">
          {[
            { v: "1,840", l: "Active members" },
            { v: "12", l: "Captain-led pods" },
            { v: "₹14L", l: "Saved by members in 2025" },
            { v: "2,340 kg", l: "Cardboard avoided" },
          ].map((t) => (
            <div key={t.l} className="rounded-2xl bg-ng-sage/40 border border-ng-line p-6 text-center">
              <div className="font-display text-[40px] text-ng-forest-deep leading-none">{t.v}</div>
              <div className="text-[11.5px] uppercase tracking-wider text-ng-forest mt-3">{t.l}</div>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
