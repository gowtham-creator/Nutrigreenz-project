import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { JOURNAL } from "@/components/ng/data";

const CATEGORY_TONE: Record<string, string> = {
  science: "bg-ng-forest text-ng-cream",
  "field-notes": "bg-ng-clay text-ng-forest-deep",
  recipes: "bg-ng-terracotta text-ng-cream",
  guides: "bg-ng-leaf text-ng-forest-deep",
};

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = JOURNAL.find((a) => a.slug === slug);
  if (!article) notFound();

  const related = JOURNAL.filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <PageShell>
      {/* Hero — image banner sits above the heading, which lives in its own block (no overlap) */}
      <article>
        <header className="relative overflow-hidden bg-ng-forest-deep text-ng-cream">
          {/* On-theme depth for the caption band below the banner — a soft
              leaf/forest glow rising into the title block, matching the forest
              heroes elsewhere. The image sits in its own ratio block above, so
              the heading never overlaps the photograph. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "radial-gradient(ellipse 62% 90% at 90% 130%, rgba(102,191,115,0.16), transparent 60%), radial-gradient(ellipse 52% 80% at 6% 130%, rgba(76,175,80,0.10), transparent 62%)",
            }}
          />
          <div className="relative aspect-[21/9] md:aspect-[3/1] overflow-hidden">
            <Image src={article.cover} alt={article.title} fill className="object-cover" sizes="100vw" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep/80 via-ng-forest-deep/10 to-transparent" />
          </div>
          <div className="relative mx-auto max-w-3xl px-5 md:px-8 py-10 md:py-14">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${CATEGORY_TONE[article.category]}`}>
              {article.category.replace("-", " ")}
            </span>
            <h1 className="font-display text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-tight mt-4">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 mt-5 text-[13px] text-ng-cream/70">
              <span>{new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              <span>·</span>
              <span>{article.readMinutes} min read</span>
              <span>·</span>
              <span>By Nutrigreenz Field Desk</span>
            </div>
          </div>
        </header>

        <Section className="!pt-12">
          <div className="mx-auto max-w-3xl prose-article">
            <p className="font-display text-[clamp(20px,2.2vw,28px)] leading-snug text-ng-forest-deep">
              {article.excerpt}
            </p>

            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. The slow pace of bilona — three days of churning, two days of resting — is not a marketing line; it's a chemical reality that nothing in modern dairy technology has been able to shortcut.
            </p>

            <h2>The science underneath the slowness</h2>
            <p>
              When milk is cultured at low temperature for 48 hours, the lactic-acid bacteria break down lactose more thoroughly. The resulting curd, churned by hand at the right rhythm, releases butter with a fundamentally different fatty-acid profile — shorter-chain triglycerides, more conjugated linoleic acid, and a richer aromatic compound bouquet.
            </p>

            <blockquote>
              "I learned from my grandmother. The butter tells you when it's done — you don't tell it."
              <footer>— Hetal Pateel, Junagadh</footer>
            </blockquote>

            <h2>Why we will not industrialise this</h2>
            <p>
              Several large dairies have asked us about white-labeling our ghee using continuous-flow centrifuge methods. We've politely declined. The yield is higher, the cost-per-jar is lower, but the result is not the same product. We'd rather sell fewer jars of the real thing than more jars of something we couldn't stand behind.
            </p>

            <p>
              If you scan the lot code on your jar, you can see Hetal's name, the exact day the milk was set, and the day the ghee was bottled. That receipt is the contract. It's the reason we exist.
            </p>
          </div>
        </Section>
      </article>

      {/* Related */}
      <Section className="bg-ng-cream-mesh bg-ng-cream" eyebrow="Keep reading" heading="More from the Journal">
        <div className="grid md:grid-cols-3 gap-6">
          {related.map((r) => (
            <Link key={r.id} href={`/journal/${r.slug}`} className="group flex h-full flex-col rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={r.cover} alt={r.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-[18px] text-ng-forest-deep group-hover:text-ng-leaf transition-colors leading-tight">
                  {r.title}
                </h3>
                <div className="mt-auto pt-3 text-[12px] text-ng-ink-soft">{r.readMinutes} min read</div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

export function generateStaticParams() {
  return JOURNAL.map((a) => ({ slug: a.slug }));
}
