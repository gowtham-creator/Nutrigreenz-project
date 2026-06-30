import { Reveal } from "@/components/ng/motion";

interface ProductDescriptionProps {
  /** One or two short paragraphs of story copy. */
  paragraphs: string[];
  /** Heading shown above the copy. */
  heading?: string;
}

/**
 * ProductDescription — the "PRODUCT DESCRIPTION" block: a heading plus a couple
 * of short paragraphs of editorial story copy, sitting directly below the buy
 * panel. Kept narrow for comfortable reading.
 */
export function ProductDescription({ paragraphs, heading = "Product description" }: ProductDescriptionProps) {
  return (
    <Reveal className="flex max-w-3xl flex-col gap-4">
      <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.18em] text-ng-forest-deep">
        {heading}
      </h2>
      <div className="flex flex-col gap-3">
        {paragraphs.map((p) => (
          <p key={p} className="text-[15px] leading-relaxed text-ng-ink">
            {p}
          </p>
        ))}
      </div>
    </Reveal>
  );
}
