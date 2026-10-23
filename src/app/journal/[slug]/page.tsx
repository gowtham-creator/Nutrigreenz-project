import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { Section } from "@/components/ng/section";
import { Reveal } from "@/components/ng/motion";
import { getJournal, listJournals } from "@/lib/content";
import { pageMeta, articleJsonLd, breadcrumbJsonLd, fitTitle } from "@/lib/seo";
import { JsonLd } from "@/components/ng/json-ld";
import { ProductCard } from "@/components/ng/product-card";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";
import type { Metadata } from "next";

export const revalidate = 60;

/**
 * Which shop category an article is about, from the words in its title and tags.
 *
 * Articles explained bilona churning or raw honey and then linked nowhere but
 * other articles, so a reader convinced by the piece had to go and find the
 * product. The first matching rule wins; an article that matches none simply
 * shows no products.
 */
const TOPIC_CATEGORY: [RegExp, string][] = [
  [/\b(ghee|bilona|a2|butter)\b/i, "ghee"],
  [/\b(honey|bees?|hive|apiary)\b/i, "honey"],
  [/\b(oils?|ghani|ganuga|cold[- ]pressed|wood[- ]pressed|groundnut|sesame|coconut|mustard)\b/i, "oils"],
];

function topicCategory(text: string): string | null {
  return TOPIC_CATEGORY.find(([re]) => re.test(text))?.[1] ?? null;
}

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getJournal(slug);
  if (!article) return { title: "Article not found · Nutri Greenz", robots: { index: false } };
  return pageMeta({
    title: fitTitle(`${article.title} · Nutri Greenz`, article.title),
    description: article.excerpt,
    path: `/journal/${article.slug}`,
    image: article.cover,
    type: "article",
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getJournal(slug);
  if (!article) notFound();

  const related = (await listJournals()).filter((a) => a.slug !== slug).slice(0, 3);
  const topic = topicCategory([article.title, article.excerpt, ...article.tags].join(" "));
  const shopFor = topic
    ? (await getStorefrontCatalog().catch(() => null))?.products.filter((p) => p.tags?.includes(topic)).slice(0, 4) ?? []
    : [];

  // The excerpt renders as the article lead; the DB `body` (admin-authored,
  // trusted HTML) supplies the rest. Both are direct children of `.prose-article`
  // so the `> p / > h2 / > blockquote` typography rules apply unchanged.
  const leadHtml = `<p class="font-display text-[clamp(20px,2.2vw,28px)] leading-snug text-ng-forest-deep">${escapeHtml(
    article.excerpt,
  )}</p>`;

  return (
    <PageShell>
      <JsonLd
        data={articleJsonLd({
          title: article.title,
          description: article.excerpt,
          path: `/journal/${article.slug}`,
          image: article.cover,
          author: article.author,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Journal", path: "/journal" },
          { name: article.title, path: `/journal/${article.slug}` },
        ])}
      />
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

      {/* Products the article is about */}
      {topic && shopFor.length > 0 ? (
        <Section className="!pt-0" eyebrow="From the shop" heading="Try what you just read about">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {shopFor.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <p className="mt-8 text-[15px]">
            <Link href={`/shop/${topic}`} className="font-medium text-ng-forest underline decoration-ng-leaf/40 underline-offset-4 hover:text-ng-leaf">
              See all {topic === "oils" ? "cold-pressed oils" : topic}
            </Link>
          </p>
        </Section>
      ) : null}

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
