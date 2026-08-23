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
  /* Supplied for the Reports surfaces. Solar's `chart-2` was a bare line
     chart; this one is a chart ON a document, which is what a report is. */
  reports: "reports",
  /* Supplied mark for campaign targeting / goals. */
  target: "target",
  /* Honey. The file shipped with the supplied set but was never registered,
     so `name="bee"` resolved to nothing wherever it was used. */
  bee: "bee",
  /* Cold-pressed oils. The produce PNG in app-icon.tsx is a thin-line
     drawing, so as a mask at chip size it thinned out to grey beside the
     solid marks next to it. This is the supplied glyph, traced to vector. */
  groundnut: "groundnut",
  /* Customer account nav — supplied glyph set. */
  overview: "overview",
  ordersBox: "orders-box",
  wallet: "wallet",
  refer: "refer",
  location: "location",
  /* Account profile surfaces. `password` and `key` were supplied as GIFs on an
     opaque white field, so they were traced from LUMINANCE, not alpha — tracing
     their alpha would have yielded an empty file. */
  profile: "profile",
  password: "password",
  key: "key",
  /* Supplied mail glyph. Was a 60px raster in app-icon.tsx, so it softened
     wherever it was drawn above ~30px. */
  email: "email",
  /* The brand cart glyph. It shipped as a vector for CartIcon but was never
     registered here, so `name="cart"` could not be used anywhere else. */
  cart: "cart",
  /* Config / settings, wherever the app talks about configuration. */
  settings: "settings",
  /* Coupons and vouchers. Not price tags — see the note in the commit. */
  coupon: "coupon",
  /* Platform marks for the session list. */
  iphone: "iphone",
  macos: "macos",
  android: "android",
  windows: "windows",
  status: "status",
  signin: "signin",
  save: "save",
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
  /* Notifications. The animated form lives in <BellIcon>; this is the static
     cut, for the storefront. */
  bell: "bell",
  /* Admin sidebar. `catalog` and `analytics` are the supplied marks; `customer`
     is the person outline used for shoppers everywhere. */
  catalog: "catalog",
  analytics: "analytics",
  customer: "customer",
  /* Field-sales captains, and the audit log. */
  captain: "captain",
  audit: "audit",
  /* Product categories, and the wishlist. */
  category: "category",
  wishlist: "wishlist",
  /* Data in and out: CSV import, CSV export, invoice download. */
  import: "import",
  export: "export",
} as const;

export type UiIconName = keyof typeof UI_ICONS;

/**
 * The set of names this family answers to.
 *
 * For call sites that hold icon names as data and mix families — the admin nav,
 * the roles list, the toast tone map. Rendering a UiIcon name through Solar's
 * <Icon> resolves to no glyph and draws nothing, with no type error to catch it,
 * because both components take a plain string.
 */
export const UI_ICON_NAMES: ReadonlySet<string> = new Set(Object.keys(UI_ICONS));

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
