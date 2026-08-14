import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { PRODUCTS } from "@/components/ng/data";

const BUNDLE_LINEUP = PRODUCTS.slice(0, 8).map((p, i) => ({
  ...p,
  podPrice: Math.round((p.price ?? 0) * (1 - [0.12, 0.1, 0.08, 0.14, 0.09, 0.11, 0.13, 0.1][i]!)),
  podSavings: [0.12, 0.1, 0.08, 0.14, 0.09, 0.11, 0.13, 0.1][i]! * 100,
  remaining: [4, 12, 8, 2, 18, 6, 22, 9][i],
}));

export default function CommunityBundleInventory() {
  return (
    <PageShell>
      {/* Pod context strip */}
      <div className="bg-ng-forest-deep text-ng-cream">
        <div className="mx-auto max-w-7xl px-5 md:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/community/bundle" className="text-[12px] text-ng-clay hover:underline">← All pods</Link>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h1 className="font-display text-[26px] leading-tight">Madhapur pod · May cycle</h1>
              <span className="text-[12px] text-ng-cream/60">Captain Sneha Kumar · 1.2 km from you</span>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="text-right">
              <div className="text-[10.5px] uppercase tracking-wider text-ng-clay">Cycle closes</div>
              <div className="font-display text-[18px] text-ng-cream">22 May · 22:00</div>
            </div>
            <Link href="/community/bundle/checkout" className="rounded-full bg-ng-clay text-ng-forest-deep font-semibold px-5 py-2 text-[13px]">
              View bag (3)
            </Link>
          </div>
        </div>
      </div>

      <Section className="!py-12">
        <div className="grid lg:grid-cols-[1fr_3fr] gap-10">
          {/* Filter sidebar */}
          <aside className="lg:sticky lg:top-24 self-start space-y-6">
            <div>
              <h3 className="font-display text-[16px] text-ng-forest-deep mb-3">Categories</h3>
              <div className="flex flex-col gap-2 text-[13px]">
                {["All (8)", "Cold-pressed oils (4)", "A2 Ghee (1)", "Honey (1)", "Millets & flours (2)"].map((c, i) => (
                  <button key={c} className={`text-left px-3 py-2 rounded-xl ${i === 0 ? "bg-ng-sage/60 text-ng-forest-deep font-semibold" : "text-ng-ink-muted hover:bg-ng-paper"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-ng-clay/20 border border-ng-clay/40 p-5">
              <div className="text-[10px] uppercase tracking-wider text-ng-forest font-bold">Pod special</div>
              <h3 className="font-display text-[18px] text-ng-forest-deep mt-2 leading-tight">All items 8–14% off retail.</h3>
              <p className="text-[12px] text-ng-ink-muted mt-2 leading-relaxed">Same lot · same lab report · same farmer. Lower price because zero last-mile.</p>
            </div>

            <div className="rounded-2xl bg-ng-paper border border-ng-line-soft p-5">
              <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Your pickup</div>
              <div className="font-display text-[16px] text-ng-forest-deep mt-2">14 Jubilee Hills Road No: 36</div>
              <div className="text-[12px] text-ng-ink-muted mt-1">23 May, 17:00–20:00</div>
            </div>
          </aside>

          {/* Inventory grid */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-[14px] text-ng-ink-muted">{BUNDLE_LINEUP.length} products in this pod's lot</span>
              <select className="rounded-full bg-ng-paper border border-ng-line-soft px-4 py-2 text-[13px] outline-none">
                <option>Best value first</option>
                <option>Most popular</option>
                <option>Lowest price</option>
                <option>Highest rated</option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
              {BUNDLE_LINEUP.map((p) => (
                <article key={p.id} className="rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden flex flex-col">
                  <div className="relative aspect-square bg-ng-sage">
                    <Image src={p.image} alt={p.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                    <span className="absolute top-3 left-3 bg-ng-forest-deep text-ng-clay text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full">
                      Pod price · save {p.podSavings.toFixed(0)}%
                    </span>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-display text-[14.5px] leading-tight text-ng-forest-deep">{p.title}</h3>
                    <div className="text-[11px] text-ng-ink-soft mt-1">{p.unit}</div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-[20px] text-ng-forest-deep">₹{p.podPrice.toLocaleString()}</span>
                      <span className="text-[12px] text-ng-ink-soft line-through">₹{p.price?.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-ng-terracotta mt-1">{p.remaining} jars left in pod</div>
                    <Button variant="primary" size="sm" fullWidth className="mt-3">Add to bag</Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}
