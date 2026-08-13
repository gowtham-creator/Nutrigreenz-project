import { cn } from "@/lib/utils";

/**
 * BrandName — the company name set as the wordmark, in running text.
 *
 * ── What this is for ──────────────────────────────────────────────────────
 *
 * Headings that name the company were setting it like any other emphasised
 * phrase: `<em className="italic text-ng-leaf">`, which is bright accent green
 * (#66BF73) in italic Roboto Slab. Nothing about that resembles the wordmark
 * on our own packaging — wrong case, wrong face, wrong weight, wrong green —
 * so the one word on the page that should have been instantly recognisable was
 * the one styled as though the brand had no typography of its own.
 *
 * This is NOT the logo. Dropping the logo image into a sentence would set the
 * brand at a fixed size and colour in the middle of running text, break the
 * line box, and hand a screen reader an image where a word belongs. This is
 * live text that borrows the wordmark's treatment — so it wraps, scales with
 * its heading, inherits alignment, and remains selectable and searchable.
 *
 * ── The treatment, and where each value comes from ────────────────────────
 *
 * Sampled from `public/brand/logo-wordmark.png` rather than guessed:
 *
 *   · Uppercase, as the wordmark is drawn.
 *   · `font-serif` — Lora. The wordmark is a higher-contrast serif than Lora,
 *     but Lora is the only serif already loaded, and one more webfont for one
 *     word on a few headings is not a trade worth making. It reads as the same
 *     kind of letter: classic, bracketed serifs, upright.
 *   · `#293E24`, the ink sampled off the wordmark itself. Close to
 *     `--ng-forest-soft` but a touch warmer, and since the whole point is to
 *     match the printed mark, it uses the printed mark's green.
 *   · 0.04em tracking, matching the wordmark's letterspacing.
 *   · 0.86em, because uppercase reads optically larger than the mixed-case
 *     words beside it; at 1em the name looked shouted rather than set.
 *
 * Punctuation stays OUTSIDE this component — `<BrandName />?` not
 * `<BrandName>Nutri Greenz?</BrandName>` — so a question mark is not
 * letterspaced away from the word it belongs to.
 */
export function BrandName({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-serif font-semibold uppercase not-italic tracking-[0.04em]",
        "text-[0.86em] text-[#293E24]",
        className,
      )}
    >
      Nutri Greenz
    </span>
  );
}
