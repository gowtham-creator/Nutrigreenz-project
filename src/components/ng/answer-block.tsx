import Link from "next/link";
import { Reveal } from "@/components/ng/motion";

/**
 * "What is this?" in one paragraph, with the facts beside it.
 *
 * Product pages and the About page sold well but never said plainly what the
 * thing was, so a search engine or AI assistant looking for a definition had
 * to piece one together from marketing copy. The answer here stands on its own
 * when quoted, and the fact list is a plain <dl> that machines read as
 * label → value.
 */
export function AnswerBlock({
  question,
  answer,
  facts,
}: {
  question: string;
  answer: string;
  facts: { label: string; value: string; href?: string }[];
}) {
  return (
    <Reveal className="grid grid-cols-1 gap-8 rounded-3xl border border-ng-line-soft bg-white/60 p-6 md:grid-cols-[1.4fr_1fr] md:gap-12 md:p-10">
      <div className="flex flex-col gap-4">
        <span className="ng-eyebrow">At a glance</span>
        <h2 className="font-display text-[clamp(24px,3vw,34px)] leading-[1.1] tracking-tight text-ng-forest-deep">{question}</h2>
        <p className="text-[15px] leading-relaxed text-ng-ink md:text-[16px]">{answer}</p>
      </div>
      <dl className="grid grid-cols-1 gap-y-4 self-start text-[14px]">
        {facts.map((f) => (
          <div key={f.label} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-ng-line-soft/70 pb-3 last:border-0 last:pb-0">
            <dt className="font-medium text-ng-ink-muted">{f.label}</dt>
            <dd className="text-ng-forest-deep">
              {f.href ? (
                <Link href={f.href} className="underline decoration-ng-leaf/40 underline-offset-4 hover:text-ng-forest">
                  {f.value}
                </Link>
              ) : (
                f.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}
