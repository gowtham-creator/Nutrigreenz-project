import Image from "next/image";
import Link from "next/link";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Chip } from "@/components/ng/chip";
import { Reveal } from "@/components/ng/motion";
import { listJournals } from "@/lib/content";

// Editorial content is DB-backed; revalidate so admin edits appear without a deploy.
export const revalidate = 60;

const CATEGORIES = ["All", "Science", "Field notes", "Recipes", "Guides"];
const CATEGORY_TONE: Record<string, string> = {
  science: "bg-ng-forest text-ng-cream",
  "field-notes": "bg-ng-clay text-ng-forest-deep",
  recipes: "bg-ng-terracotta text-ng-cream",
  guides: "bg-ng-leaf text-ng-forest-deep",
};

export default async function JournalIndex() {
  // Reads the DB (falls back to the static sample content when unconfigured/empty).
  const articles = await listJournals();
  const featured = articles[0]!;
  const rest = articles.slice(1);

  return (
    <PageShell>
      <PageHero
        tint="editorial"
        image="/images/journal/journal-hero.webp"
        eyebrow="The Nutrigreenz Journal"
        title={<>Long-form reporting <em className="italic text-ng-leaf">from the field.</em></>}
        description="Updated every fortnight. Stories from the farms, recipes from our partner kitchens, deep dives on lab science, and the occasional honest mistake."
      />

      <Section>
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map((c, i) => (
            <Chip key={c} data-active={i === 0 ? "true" : undefined}>{c}</Chip>
          ))}
        </div>

        {/* Featured */}
        <Reveal>
          <Link
            href={`/journal/${featured.slug}`}
            className="group grid lg:grid-cols-2 gap-8 lg:gap-12 mb-16 rounded-3xl overflow-hidden bg-ng-paper border border-ng-line-soft p-3 hover:shadow-[var(--shadow-ng-float)] transition-shadow"
          >
            <div className="relative aspect-[4/3] lg:aspect-auto overflow-hidden rounded-2xl">
              <Image src={featured.cover} alt={featured.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
            <div className="flex flex-col justify-center p-6 lg:p-10">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${CATEGORY_TONE[featured.category] ?? "bg-ng-sage text-ng-forest-deep"}`}>
                  {featured.category.replace("-", " ")}
                </span>
                <span className="text-[12px] text-ng-ink-soft">Featured · {featured.readMinutes} min read</span>
              </div>
              <h2 className="font-display text-[clamp(28px,3.6vw,44px)] leading-tight text-ng-forest-deep group-hover:text-ng-leaf transition-colors">
                {featured.title}
              </h2>
              <p className="text-[16px] text-ng-ink-muted mt-4 leading-relaxed max-w-md">
                {featured.excerpt}
              </p>
              <div className="mt-7 text-[13px] text-ng-forest font-medium">Read the full piece →</div>
            </div>
          </Link>
        </Reveal>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
          {rest.map((a, i) => (
            <Reveal key={a.id} className="h-full" delay={(i % 3) * 0.08}>
              <Link
                href={`/journal/${a.slug}`}
                className="group flex h-full flex-col rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={a.cover} alt={a.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
                  <span className={`absolute top-3 left-3 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${CATEGORY_TONE[a.category] ?? "bg-ng-sage text-ng-forest-deep"}`}>
                    {a.category.replace("-", " ")}
                  </span>
                </div>
                <div className="flex flex-col flex-1 p-6">
                  <h3 className="font-display text-[20px] leading-tight text-ng-forest-deep group-hover:text-ng-leaf transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-[14px] text-ng-ink-muted mt-3 leading-relaxed line-clamp-3 flex-1">{a.excerpt}</p>
                  <div className="mt-5 pt-4 border-t border-ng-line-soft flex items-center justify-between text-[12px] text-ng-ink-soft">
                    <span>{new Date(a.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>{a.readMinutes} min read</span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Subscribe band */}
      <Section className="bg-ng-forest-deep text-ng-cream !py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="ng-eyebrow text-ng-clay">Harvest letter</span>
            <h2 className="font-display text-[clamp(28px,4vw,42px)] leading-tight text-ng-cream mt-3">
              One letter a month. <em className="italic text-ng-clay">Zero marketing.</em>
            </h2>
          </div>
          <form className="flex gap-3">
            <input type="email" placeholder="your@email.com" className="flex-1 rounded-full bg-ng-cream/10 border border-ng-cream/20 text-ng-cream placeholder:text-ng-cream/40 px-5 py-3" />
            <button className="rounded-full bg-ng-clay text-ng-forest-deep font-semibold px-6 py-3 hover:bg-ng-clay-deep transition-colors">Subscribe</button>
          </form>
        </div>
      </Section>
    </PageShell>
  );
}
