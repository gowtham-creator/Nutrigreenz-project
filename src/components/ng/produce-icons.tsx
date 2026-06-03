import { PRODUCE_ICON_DATA } from "./produce-icons-data";
import { cn } from "@/lib/utils";

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
}: IconProps & { iconKey: keyof typeof PRODUCE_ICON_DATA }) {
  const data = PRODUCE_ICON_DATA[iconKey] ?? PRODUCE_ICON_DATA.leaf;
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

export const PRODUCE_ICONS = {
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
} as const;

export type ProduceIconName = keyof typeof PRODUCE_ICONS;
