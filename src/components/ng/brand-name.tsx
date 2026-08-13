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
 *   · `#2F4729`, the ink read off the wordmark itself.
 *
 *     Worth recording how that number was arrived at, because the obvious
 *     method gives the wrong answer. Averaging the darkest pixels in the file
 *     returns #293E24 — visibly darker and duller than the mark actually is —
 *     because the darkest pixels include every anti-aliased edge, where the
 *     ink is already blending toward the background. The real value comes from
 *     sampling only pixels whose whole 5x5 neighbourhood is also ink, so no
 *     edge pixel is counted, and #2F4729 is then both the modal colour and the
 *     mean of that set.
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
        "text-[0.86em] text-[#2F4729]",
        className,
      )}
    >
      Nutri Greenz
    </span>
  );
}
