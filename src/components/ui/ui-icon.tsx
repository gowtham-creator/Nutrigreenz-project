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
} as const;

export type UiIconName = keyof typeof UI_ICONS;

export function UiIcon({
  name,
  size = 20,
  className,
}: {
  name: UiIconName;
  size?: number;
  className?: string;
}) {
  const url = `url(/icons/ui/${UI_ICONS[name]}.svg)`;
  return (
    <span
      aria-hidden
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
