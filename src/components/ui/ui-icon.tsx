import { cn } from "@/lib/utils";

/**
 * UiIcon — interface marks from the Icons8 iOS set, traced to vector.
 *
 * Separate from {@link AppIcon} (our products) and {@link BrandIcon} (Lucide
 * concepts) because these are chrome: the magnifier in the search field, the
 * bag on a category row. Same masking technique throughout, so all three
 * families tint from `currentColor` and can sit in one row without one of them
 * arriving as a fixed-colour image.
 *
 * Traced rather than used as PNGs for the reason given at length in
 * `promise-icon.tsx`: the source is 200px, these draw at 17–20px, and vector
 * stays sharp at any size on any display while a bitmap cannot.
 *
 * Source: Icons8, credited on /policies/attributions.
 */

const UI_ICONS = {
  search: "search",
  bag: "bag",
  /* The vision row on /about. Solar had a leaf for soil, a globe for farming
     and a shield-tick for customers — three generic marks for three specific
     ideas, none of which were about soil, a farm or a customer. */
  soil: "soil",
  farmhouse: "farmhouse",
  customers: "customers",
  /* The storefront trust band. Lucide had a tick-badge for an FSSAI licence, a
     conical flask for the lab, footprints for traceability and a van for
     delivery — three of the four were metaphors for the idea rather than
     pictures of the thing. A licence looks like a certificate and a lot code is
     scanned from a QR square; drawing them that way needs no explaining. */
  certificate: "certificate",
  flask: "flask",
  qr: "qr",
  delivery: "delivery",
  /* The shop hero's rating chip. */
  star: "star",
  /* The oil cruet, for "cold-pressed" — the product itself rather than a
     sprout gesturing at freshness. */
  press: "press",
  /* The produce mark on a product card's category line and in the cart. */
  leaf: "leaf",
  /* The scalloped verification badge on the PDP credential strip. */
  verified: "verified",
  /* An order: a lined docket with a tick. Used for the order summary, the
     order history and the admin Orders section. */
  order: "order",
  /* Secure payment, on the cart trust rows. */
  lock: "lock",
  /* The "!" warning mark, everywhere a caution is raised. */
  caution: "caution",
  /* Pack size — the unit line on a product card and the cart line item. */
  weight: "weight",
  /* The super-admin role badge. */
  admin: "admin",
} as const;

export type UiIconName = keyof typeof UI_ICONS;

export function UiIcon({
  name,
  size = 20,
  className,
  label,
}: {
  name: UiIconName;
  size?: number;
  className?: string;
  /**
   * Accessible name, for the cases where the icon IS the message.
   *
   * Decorative by default — an icon beside its own label is noise to a screen
   * reader, which would otherwise hear the meaning twice. But a caution mark
   * standing alone, with the warning carried only by colour and shape, is
   * silent without this. Matches the `label` prop on {@link Icon} so the two
   * families behave the same at call sites.
   */
  label?: string;
}) {
  const url = `url(/icons/ui/${UI_ICONS[name]}.svg)`;
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
