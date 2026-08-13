import { PRODUCE_ICON_DATA } from "./produce-icons-data";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";

/**
 * Categories drawn from the imported Icons8 set instead of the inline family.
 *
 * These two were chosen for being far more specific than the generic family
 * shapes: a honey jar with comb rather than a droplet, a pressed-oil bottle
 * rather than a bottle outline.
 *
 * They still tint. Both are painted through AppIcon as CSS masks, so they take
 * the category chip's accent from `currentColor` exactly as the inline SVGs do
 * — which is the property that would have been lost had they been dropped in as
 * images. The oil mark shipped as colour line art on a pale disc and was
 * flattened to a mono glyph first; masked in its original form the disc counts
 * as ink and the icon collapses into a filled circle.
 */
const IMPORTED: Record<string, AppIconName> = {
  honey: "honey",
  oil: "oil",
  /*
   * The individual oils. "Know your oil" used to label sesame with a seedling,
   * coconut with a leaf and mustard with a grain — generic produce shapes
   * standing in for four products that look nothing alike. A comparison table
   * whose whole job is telling them apart should not draw them the same.
   */
  groundnut: "groundnut",
  sesame: "sesame",
  olive: "olive",
  mustard: "mustard",
  coconut: "coconut",
};

/**
 * Nutri Greenz produce category icons — a single cohesive, professionally
 * designed icon family (Phosphor duotone), inlined from `produce-icons-data`
 * so they render instantly offline with no icon-set dependency in the bundle.
 * Each icon is two-tone in `currentColor`, so the category chip's accent colour
 * tints it automatically.
 */

interface IconProps {
  className?: string;
  size?: number;
}

function ProduceGlyph({
  iconKey,
  className,
  size = 32,
}: IconProps & { iconKey: string }) {
  const imported = IMPORTED[iconKey];
  if (imported) {
    return <AppIcon name={imported} size={size} className={cn("inline-block shrink-0", className)} />;
  }

  const data = PRODUCE_ICON_DATA[iconKey as keyof typeof PRODUCE_ICON_DATA] ?? PRODUCE_ICON_DATA.leaf;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${data.w} ${data.h}`}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block shrink-0", className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: data.body }}
    />
  );
}

/**
 * The Nutri Greenz monogram, for the "All" tab.
 *
 * Every other tab in these rows shows the thing it filters to — a honey jar, an
 * olive, a groundnut. "All" has no such thing, and it was borrowing the generic
 * leaf, which then had to stand for both "everything we sell" and, on the oils
 * row, for safflower specifically. The house mark is the honest answer: the tab
 * that means "all of it" shows whose catalogue it is.
 *
 * Traced from `public/brand/logo-mark.png` to outlines and painted as a mask,
 * so it takes `currentColor` like every other glyph in the row rather than
 * arriving as a fixed two-tone green logo dropped into a monochrome set. The
 * threshold was taken on luminance rather than alpha specifically to keep the
 * lighter vein inside the leaf as a cut-out; an alpha silhouette filled it in
 * and lost the drawing.
 */
function BrandMarkGlyph({ className, size = 32 }: IconProps) {
  const url = "url(/icons/brand/mark-n.svg)";
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

export const BrandMarkIcon = (p: IconProps) => <BrandMarkGlyph {...p} />;

export const LeafIcon = (p: IconProps) => <ProduceGlyph iconKey="leaf" {...p} />;
export const GheeIcon = (p: IconProps) => <ProduceGlyph iconKey="ghee" {...p} />;
export const OilIcon = (p: IconProps) => <ProduceGlyph iconKey="oil" {...p} />;
export const GrainIcon = (p: IconProps) => <ProduceGlyph iconKey="grain" {...p} />;
export const SeedlingIcon = (p: IconProps) => <ProduceGlyph iconKey="seedling" {...p} />;
export const HoneyIcon = (p: IconProps) => <ProduceGlyph iconKey="honey" {...p} />;
export const SpiceIcon = (p: IconProps) => <ProduceGlyph iconKey="spice" {...p} />;
export const MilkIcon = (p: IconProps) => <ProduceGlyph iconKey="milk" {...p} />;
export const FruitIcon = (p: IconProps) => <ProduceGlyph iconKey="fruit" {...p} />;
export const GiftIcon = (p: IconProps) => <ProduceGlyph iconKey="gift" {...p} />;
export const FlourIcon = (p: IconProps) => <ProduceGlyph iconKey="flour" {...p} />;
export const NutsIcon = (p: IconProps) => <ProduceGlyph iconKey="nuts" {...p} />;

export const GroundnutIcon = (p: IconProps) => <ProduceGlyph iconKey="groundnut" {...p} />;
export const SesameIcon = (p: IconProps) => <ProduceGlyph iconKey="sesame" {...p} />;
export const OliveIcon = (p: IconProps) => <ProduceGlyph iconKey="olive" {...p} />;
export const MustardIcon = (p: IconProps) => <ProduceGlyph iconKey="mustard" {...p} />;
export const CoconutIcon = (p: IconProps) => <ProduceGlyph iconKey="coconut" {...p} />;

export const PRODUCE_ICONS = {
  brandMark: BrandMarkIcon,
  leaf: LeafIcon,
  ghee: GheeIcon,
  oil: OilIcon,
  grain: GrainIcon,
  seedling: SeedlingIcon,
  honey: HoneyIcon,
  spice: SpiceIcon,
  milk: MilkIcon,
  fruit: FruitIcon,
  gift: GiftIcon,
  flour: FlourIcon,
  nuts: NutsIcon,
  groundnut: GroundnutIcon,
  sesame: SesameIcon,
  olive: OliveIcon,
  mustard: MustardIcon,
  coconut: CoconutIcon,
} as const;

export type ProduceIconName = keyof typeof PRODUCE_ICONS;
