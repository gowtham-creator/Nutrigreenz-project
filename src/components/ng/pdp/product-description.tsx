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
  /*
   * No max-width here. This now sits inside the buy column, which sets the
   * measure itself — a 3xl cap would be dead code at best, and on a wide screen
   * it would fight the column it lives in.
   */
  return (
    <Reveal className="flex flex-col gap-4">
      <h2 className="ng-eyebrow">{heading}</h2>
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
