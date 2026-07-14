import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { getJournal, listJournals } from "@/lib/content";

export const revalidate = 60;

const CATEGORY_TONE: Record<string, string> = {
  science: "bg-ng-forest text-ng-cream",
  "field-notes": "bg-ng-clay text-ng-forest-deep",
  recipes: "bg-ng-terracotta text-ng-cream",
  guides: "bg-ng-leaf text-ng-forest-deep",
};

/** Escape user text for safe interpolation into the article lead paragraph. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getJournal(slug);
  if (!article) notFound();

  const related = (await listJournals()).filter((a) => a.slug !== slug).slice(0, 3);

  // The excerpt renders as the article lead; the DB `body` (admin-authored,
  // trusted HTML) supplies the rest. Both are direct children of `.prose-article`
  // so the `> p / > h2 / > blockquote` typography rules apply unchanged.
  const leadHtml = `<p class="font-display text-[clamp(20px,2.2vw,28px)] leading-snug text-ng-forest-deep">${escapeHtml(
    article.excerpt,
  )}</p>`;

  return (
    <PageShell>
      <article>
        {/* Hero — the cover image fills the banner edge-to-edge and the heading
            sits over it on a bottom-anchored scrim (no separate green band or
            gaps behind the title). Mirrors the farm-detail hero treatment. */}
        <header className="relative bg-ng-forest-deep">
          <div className="relative aspect-[21/9] md:aspect-[3/1] overflow-hidden">
            <Image src={article.cover} alt={article.title} fill className="object-cover" sizes="100vw" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep/85 via-ng-forest-deep/25 to-transparent" />
            <div className="absolute inset-0 flex items-end">
              <div className="mx-auto max-w-3xl w-full px-5 md:px-8 pb-8 md:pb-12 text-ng-cream">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${CATEGORY_TONE[article.category] ?? "bg-ng-sage text-ng-forest-deep"}`}>
                  {article.category.replace("-", " ")}
                </span>
                <h1 className="font-display text-[clamp(32px,5vw,60px)] leading-[1.05] tracking-tight mt-4 text-ng-cream">
                  {article.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-4 text-[13px] text-ng-cream/75">
                  <span>{new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                  <span>·</span>
                  <span>{article.readMinutes} min read</span>
                  <span>·</span>
                  <span>By {article.author}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <Section className="!pt-12">
          <div
            className="mx-auto max-w-3xl prose-article"
            dangerouslySetInnerHTML={{ __html: leadHtml + article.body }}
          />
        </Section>
      </article>

      {/* Related */}
      <Section className="bg-ng-cream-mesh bg-ng-cream" eyebrow="Keep reading" heading="More from the Journal">
        <div className="grid md:grid-cols-3 gap-6">
          {related.map((r, i) => (
            <Reveal key={r.id} className="h-full" delay={i * 0.08}>
              <Link href={`/journal/${r.slug}`} className="group flex h-full flex-col rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden">
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
            </Reveal>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}

export async function generateStaticParams() {
  const articles = await listJournals();
  return articles.map((a) => ({ slug: a.slug }));
}
