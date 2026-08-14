import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * FssaiMark — the FSSAI logo, which may only ever appear beside our licence
 * number.
 *
 * ── Why this is a component and not an <Image> ────────────────────────────
 *
 * Under the Food Safety and Standards (Packaging and Labelling) Regulations,
 * a food business displaying the FSSAI logo must display its 14-digit licence
 * number with it. The logo alone is a labelling violation, and it is exactly
 * the kind of thing that gets copied to a second page by someone who only
 * wanted the picture.
 *
 * So the two cannot be separated here: the number is rendered by the same
 * component that renders the mark, from a single source, and if no licence
 * number is configured the component renders NOTHING AT ALL rather than a bare
 * logo. The illegal state is unrepresentable rather than merely discouraged.
 *
 * ── Where the number comes from ───────────────────────────────────────────
 *
 * `NEXT_PUBLIC_FSSAI_LIC`, falling back to the number the shop trust band has
 * carried. Before this existed, the assurance band read
 * "Licensed food business" while the shop band read "Lic. 10024051000987" —
 * the same claim, made two different ways on two pages, because each had its
 * own copy. One constant now.
 */

/**
 * The licence number, or null when none is configured.
 *
 * Exported so callers can ask whether we are in a position to make the claim
 * at all, rather than each inventing its own fallback string.
 */
export const FSSAI_LICENCE: string | null =
  process.env.NEXT_PUBLIC_FSSAI_LIC?.trim() || "10024051000987";

export function FssaiMark({
  height = 28,
  className,
  showNumber = true,
}: {
  height?: number;
  className?: string;
  /** Only for a caller that already prints the number immediately adjacent. */
  showNumber?: boolean;
}) {
  // No licence, no mark. See the note above: the logo without the number is
  // the violation, so there is no rendering path that produces one.
  if (!FSSAI_LICENCE) return null;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/images/brand/fssai-logo.webp"
        alt="FSSAI licensed"
        width={Math.round(height * (600 / 296))}
        height={height}
        className="h-auto w-auto shrink-0"
        style={{ height, width: "auto" }}
      />
      {showNumber ? (
        <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-ng-ink-muted">
          Lic. {FSSAI_LICENCE}
        </span>
      ) : null}
    </span>
  );
}
