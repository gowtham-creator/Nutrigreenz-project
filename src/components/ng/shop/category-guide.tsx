import Link from "next/link";
import { Reveal } from "@/components/ng/motion";
import type { CategoryGuide as Guide } from "@/lib/category-guides";
import type { ProductCard } from "@/types/nutrigreenz";
import { searchName, sizeRange, variantsBySize } from "@/lib/product-seo";

/**
 * The buying guide under a category's product grid.
 *
 * Category pages were a hero, a filter and a grid: about 250 words, none of
 * them answering what a shopper (or an AI assistant) actually asks, such as
 * "what is cold-pressed oil?" or "which ghee should I buy?". Each answer sits
 * under its question as an H2 and reads on its own, and the "which one" list
 * links every product in the category, with a line on what it is for.
 */
export function CategoryGuide({ guide, products }: { guide: Guide; products: ProductCard[] }) {
  // Every product in the category is listed, so one added later still appears;
  // the line on what it is for shows when one has been written.
  const listed = products;
  return (
    <section className="relative py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 md:px-8 lg:grid-cols-2 lg:gap-16">
        {guide.answers.slice(0, 1).map((a) => (
          <Answer key={a.question} {...a} />
        ))}

        {listed.length > 0 ? (
          <Reveal className="flex flex-col gap-5">
            <h2 className="font-display text-[clamp(24px,3vw,34px)] leading-[1.1] tracking-tight text-ng-forest-deep">
              {guide.chooseQuestion}
            </h2>
            <ul className="flex flex-col divide-y divide-ng-line-soft/70 rounded-3xl border border-ng-line-soft bg-white/60">
              {listed.map((p) => {
                const sizes = sizeRange(variantsBySize(p).map((v) => v.label));
                return (
                  <li key={p.id} className="flex flex-col gap-1 px-5 py-4">
                    <Link
                      href={`/products/${p.slug}`}
                      className="font-medium text-ng-forest-deep underline decoration-ng-leaf/40 underline-offset-4 hover:text-ng-forest"
                    >
                      {searchName(p.title)}
                    </Link>
                    {guide.uses[p.slug] || sizes ? (
                      <p className="text-[14px] leading-relaxed text-ng-ink">
                        {guide.uses[p.slug]}
                        {sizes ? <span className="text-ng-ink-muted"> {sizes}.</span> : null}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Reveal>
        ) : null}

        {guide.comparison ? (
          <Reveal className="flex flex-col gap-5 lg:col-span-2">
            <h2 className="font-display text-[clamp(24px,3vw,34px)] leading-[1.1] tracking-tight text-ng-forest-deep">
              {guide.comparison.question}
            </h2>
            <div className="overflow-x-auto rounded-3xl border border-ng-line-soft bg-white/60">
              <table className="w-full min-w-[520px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-ng-line-soft text-ng-ink-muted">
                    <th scope="col" className="px-5 py-3 font-medium">
                      <span className="sr-only">Compared on</span>
                    </th>
                    {guide.comparison.columns.map((c) => (
                      <th key={c} scope="col" className="px-5 py-3 font-medium text-ng-forest-deep">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.comparison.rows.map(([label, a, b]) => (
                    <tr key={label} className="border-b border-ng-line-soft/70 last:border-0">
                      <th scope="row" className="px-5 py-3 font-medium text-ng-ink-muted">
                        {label}
                      </th>
                      <td className="px-5 py-3 text-ng-ink">{a}</td>
                      <td className="px-5 py-3 text-ng-ink">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        ) : null}

        {guide.answers.slice(1).map((a) => (
          <Answer key={a.question} {...a} />
        ))}
      </div>
    </section>
  );
}

function Answer({ question, answer }: { question: string; answer: string }) {
  return (
    <Reveal className="flex flex-col gap-4">
      <h2 className="font-display text-[clamp(24px,3vw,34px)] leading-[1.1] tracking-tight text-ng-forest-deep">{question}</h2>
      <p className="text-[15px] leading-relaxed text-ng-ink md:text-[16px]">{answer}</p>
    </Reveal>
  );
}
