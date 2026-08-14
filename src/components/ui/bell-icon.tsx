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
 * The animation is a 24-frame GIF, used as supplied. It cannot be a CSS
 * animation over the traced SVG because the frames are a drawn swing, not a
 * transform of one shape — approximating it with a rotate would look like a
 * different icon moving.
 *
 * The static form is that GIF's first frame traced to outlines, so the two are
 * the same drawing. It goes through {@link UiIcon}, which means it takes
 * `currentColor` like every other mark; the GIF cannot, and is drawn at the ink
 * it ships with. That is the trade for real motion, and it is why the animated
 * form is confined to surfaces where it is on a known background.
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
      src="/icons/ui/bell.gif"
      alt=""
      width={size}
      height={size}
      unoptimized /* Next's optimiser would flatten the GIF to a still frame. */
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
