import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Button } from "@/components/ng/button";
import { ProductCard } from "@/components/ng/product-card";
import { Reveal } from "@/components/ng/motion";
import { PRODUCTS } from "@/components/ng/data";
import { getFarm, listFarms } from "@/lib/content";

export const revalidate = 60;

// Fallback gallery used when a farm has no uploaded gallery images (keeps the
// two-up grid looking exactly as it did before the switch to DB content).
const FARM_GALLERY = [
  "/images/placeholder.svg",
  "/images/placeholder.svg",
  "/images/placeholder.svg",
];

export default async function FarmDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const farm = await getFarm(id);
  if (!farm) notFound();

  const galleryImages = farm.gallery.length > 0 ? farm.gallery : FARM_GALLERY;

  return (
    <PageShell>
      <div className="border-b border-ng-line-soft bg-ng-paper">
        <div className="mx-auto max-w-7xl px-5 md:px-8 py-3 text-[13px] text-ng-ink-soft flex gap-2">
          <Link href="/farms" className="hover:text-ng-forest">← All farms</Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative">
        <div className="relative aspect-[21/9] md:aspect-[3/1] overflow-hidden bg-ng-forest-deep">
          <Image src={farm.image ?? "/images/placeholder.svg"} alt={farm.name} fill className="object-cover" sizes="100vw" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep/85 via-ng-forest-deep/30 to-transparent" />
          <div className="absolute inset-0 flex items-end">
            <div className="mx-auto max-w-7xl w-full px-5 md:px-8 pb-10 md:pb-16 text-ng-cream">
              <span className="ng-eyebrow text-ng-clay-light">
                Partner since {farm.partneredSince ? new Date(farm.partneredSince).getFullYear() : "—"}
              </span>
              <h1 className="font-display text-[clamp(40px,6vw,72px)] leading-[1.02] tracking-tight mt-3 max-w-3xl">
                {farm.name}
              </h1>
              <p className="text-[17px] text-ng-cream/80 mt-3">
                {farm.region}{farm.hectares ? ` · ${farm.hectares} ha` : ""}{farm.farmerName ? ` · run by ${farm.farmerName}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12">
          <div className="space-y-7">
            <h2 className="font-display text-[clamp(28px,4vw,40px)] text-ng-forest-deep leading-tight">
              The story behind <em className="italic text-ng-leaf">{farm.name}</em>
            </h2>
            <p className="text-[17px] text-ng-ink-muted leading-relaxed">
              {farm.story} {" "}
              The land here is dryland, with annual rainfall under 600mm, so every choice the family makes matters. Three generations have farmed this soil, and the youngest is now trying biochar and short-rotation cover crops.
            </p>
            <p className="text-[17px] text-ng-ink-muted leading-relaxed">
              We work with them on a five-year offtake agreement, at a price renegotiated every year against an open cost-of-production formula. When wholesale prices rise, we share the gain. When the monsoon fails, we share the bridge financing.
            </p>

            {/* Gallery */}
            <div className="grid grid-cols-2 gap-3">
              {galleryImages.slice(0, 3).map((src, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                    <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 1024px) 50vw, 25vw" />
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Practices */}
            <div>
              <h3 className="font-display text-[22px] text-ng-forest-deep mb-4">Practices on this farm</h3>
              <div className="flex flex-wrap gap-2">
                {farm.practices.map((p) => (
                  <span key={p} className="px-3.5 py-1.5 rounded-full bg-ng-sage/60 text-ng-forest-deep text-[13px] capitalize">{p}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-24 self-start">
            <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-6">
              <h3 className="font-display text-[20px] text-ng-forest-deep">Farm at a glance</h3>
              <dl className="mt-4 space-y-3 text-[14px]">
                <Row label="Region" value={farm.region} />
                <Row label="Hectares" value={farm.hectares ? `${farm.hectares} ha` : "—"} />
                <Row label="Farmer" value={farm.farmerName ?? "—"} />
                <Row label="Partnered since" value={farm.partneredSince ? new Date(farm.partneredSince).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"} />
              </dl>
            </div>

            <div className="rounded-3xl bg-ng-forest-deep text-ng-cream p-7">
              <div className="text-[11px] uppercase tracking-wider text-ng-clay">Direct support</div>
              <h3 className="font-display text-[22px] mt-2 leading-tight">Contribute to {farm.farmerName ?? "this farm"}&apos;s drip-irrigation upgrade</h3>
              <p className="text-[13px] text-ng-cream/70 mt-3">
                We co-fund infrastructure with our member community. Every ₹50 from your order is matched.
              </p>
              <Button variant="gold" fullWidth className="mt-5">Learn more →</Button>
            </div>
          </aside>
        </div>
      </Section>

      {/* Products from this farm */}
      <Section
        className="bg-ng-cream-mesh bg-ng-cream"
        eyebrow="Products from this farm"
        heading={<>Sourced from <em className="italic text-ng-leaf">{farm.name}.</em></>}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {PRODUCTS.slice(0, 4).map((p, i) => (
            <Reveal key={p.id} className="h-full" delay={(i % 4) * 0.06}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 pb-3 border-b border-ng-line-soft last:border-0">
      <dt className="text-ng-ink-soft">{label}</dt>
      <dd className="text-ng-ink font-medium text-right">{value}</dd>
    </div>
  );
}

export async function generateStaticParams() {
  const farms = await listFarms();
  return farms.map((f) => ({ id: f.id }));
}
