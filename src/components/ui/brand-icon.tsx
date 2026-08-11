import {
  BadgeCheck,
  FlaskConical,
  Footprints,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Store,
  MapPin,
  Sprout,
  Tractor,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BrandIcon — the trust and place icons, drawn from Lucide.
 *
 * ── Why Lucide and not the imported PNGs ──────────────────────────────────
 *
 * The Icons8 files these replace were flat PNGs topping out at 100px, so they
 * had to be painted as CSS masks to take a colour at all and went soft above
 * about 48px. Lucide is already a dependency, ships real SVG that scales
 * anywhere and tints from `currentColor` natively, and is ISC licensed — no
 * attribution, unlike Solar's CC-BY, the Icons8 free tier, or Noun Project.
 *
 * The product glyphs deliberately did NOT move. No general icon library has a
 * honey jar or a cold-pressed oil bottle, which is exactly why those were
 * imported; they stay on AppIcon. The split is between generic CONCEPTS, which
 * any good set covers better, and our specific PRODUCTS, which none do.
 *
 * ── On weight ─────────────────────────────────────────────────────────────
 *
 * Lucide is stroke-only while Solar ships filled and linear cuts, so a default
 * 2px stroke reads thin next to a filled Solar glyph and heavy next to a linear
 * one. `weight` picks the stroke to match whichever row the icon lands in
 * rather than leaving every call site to guess a number.
 */

const ICONS = {
  lab: FlaskConical,
  shipping: Truck,
  location: MapPin,
  fresh: Sprout,
  profile: User,
  farm: Tractor,
  /*
   * The scalloped verification badge. Supplied as a 60px PNG, which would have
   * gone soft anywhere it is shown large and needed masking to take a colour at
   * all — this is the same mark as real vector, so it stays sharp and tints
   * with the surrounding text like every other icon in the row.
   */
  verified: BadgeCheck,
  /*
   * Traceability, as footprints — a trail back to the farm rather than the QR
   * square that stood here before. The QR read as "scan me", which is a
   * mechanism, not the promise.
   */
  traceable: Footprints,
  /*
   * The operator sign-in set. `profile` was already here for the shopper's
   * account; these two join it so the whole admin auth flow — the passcode
   * step, the reset link, the authenticator prompt — draws from one family
   * instead of Solar's shield-keyhole in some places and lock-password in
   * others.
   */
  lock: Lock,
  key: KeyRound,
  /*
   * Storefront and session marks. Solar spelled these three different ways
   * across the portal — shop-bold, shop-2-bold, logout-3-bold, logout-2-linear
   * — so the same action changed shape depending on which screen you were on.
   */
  store: Store,
  signOut: LogOut,
  signIn: LogIn,
} satisfies Record<string, LucideIcon>;

export type BrandIconName = keyof typeof ICONS;

/** `solid` sits beside filled Solar glyphs, `line` beside linear ones. */
type Weight = "solid" | "line";

const STROKE: Record<Weight, number> = { solid: 2.25, line: 1.75 };

interface BrandIconProps {
  name: BrandIconName;
  size?: number;
  weight?: Weight;
  className?: string;
  /** Decorative by default; pass a label when the icon carries the meaning. */
  label?: string;
}

export function BrandIcon({
  name,
  size = 22,
  weight = "solid",
  className,
  label,
}: BrandIconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={STROKE[weight]}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0", className)}
    />
  );
}
