import Image from "next/image";
import { UiIcon } from "./ui-icon";
import { cn } from "@/lib/utils";

/**
 * BellIcon — the notification mark, animated on the operator surfaces and
 * static on the storefront.
 *
 * ── Why the same mark behaves differently in two places ───────────────────
 *
 * In the admin and captain portals a bell means "something needs you now" —
 * five orders awaiting payment, an announcement to review. Motion earns its
 * place there: it is a work queue, the operator is looking for what changed,
 * and a ringing bell is the fastest way to say which row that is.
 *
 * On the storefront the same bell sits beside "Email me about restocks" — a
 * preference, not an alert. Animating it would be a shop shaking a bell at a
 * customer who asked for nothing, which is the visual equivalent of a pop-up.
 * `animated` therefore has to be opted into rather than defaulted on.
 *
 * ── Two files, one mark ───────────────────────────────────────────────────
 *
 * The animation is the supplied 24-frame sequence, re-encoded as animated WebP.
 * It is not a CSS animation over the traced SVG because the frames are a drawn
 * swing, not a transform of one shape — approximating it with a rotate would
 * look like a different icon moving.
 *
 * The re-encode exists because the source GIF ships black art on an OPAQUE
 * WHITE field: dropped onto the cream notification chip it painted a white
 * square around itself. GIF carries only 1-bit transparency, so keying the
 * white out there would have left a hard, jagged edge on every anti-aliased
 * pixel of the bell's outline. WebP has a real alpha channel, and because the
 * art is pure black on pure white, luminance IS the coverage — alpha = 255 −
 * luma keeps every partial pixel at exactly the strength it was drawn, so the
 * edge survives intact.
 *
 * The static form is that sequence's first frame traced to outlines, so the two
 * are the same drawing. It goes through {@link UiIcon} and takes
 * `currentColor` like every other mark; the animated one is flat ink and cannot,
 * which is the trade for real motion.
 */
export function BellIcon({
  size = 20,
  animated = false,
  className,
}: {
  size?: number;
  /** Operator surfaces only — see the note above. */
  animated?: boolean;
  className?: string;
}) {
  if (!animated) {
    return <UiIcon name="bell" size={size} className={className} />;
  }
  return (
    <Image
      src="/icons/ui/bell.webp"
      alt=""
      width={size}
      height={size}
      unoptimized /* Next's optimiser would flatten this to a single frame. */
      /* `ng-bell-anim` is the hook the dark console uses to invert this (see
         globals.css). Flat black art cannot take `currentColor`, so on a dark
         ground it rendered black-on-near-black — present and invisible. */
      className={cn("ng-bell-anim inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
