import { cn } from "@/lib/utils";

/**
 * Nutrigreenz monochrome line-icon family for produce categories.
 *
 * Detailed, illustrative line drawings tuned to sit inside the tinted category
 * circles. Every icon paints with `currentColor`, uses a consistent 32×32 box
 * and a 1.5 primary stroke, with a finer 1.1 secondary stroke + a couple of
 * low-opacity `currentColor` fills for depth. Designed to read crisply at 30px
 * and feel like one cohesive, premium set (cf. the Anveshan category row).
 */

interface IconProps {
  className?: string;
  size?: number;
}

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  xmlns: "http://www.w3.org/2000/svg",
});

// Finer weight + tonal fill reused across the set for inner detail.
const FINE = 1.1;
const FILL_SOFT = 0.12;
const FILL_FAINT = 0.07;

export function LeafIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* leaf body */}
      <path
        d="M6 26 C6 14.5 14.5 6 26 6 C26 17.5 17.5 26 6 26 Z"
        fill="currentColor"
        fillOpacity={FILL_FAINT}
      />
      {/* central vein */}
      <path d="M7 25 C12 18 18 12 25 7" />
      {/* side veins */}
      <path d="M11.5 20.5 C13 19 14.5 18 16.5 17.5" strokeWidth={FINE} />
      <path d="M15 17 C16.5 15.5 18 14.5 20 14" strokeWidth={FINE} />
      <path d="M18 14 C19.5 12.5 21 11.5 22.5 11" strokeWidth={FINE} />
      <path d="M11.5 20.5 C10.5 18.5 10.5 16.5 11 14.5" strokeWidth={FINE} />
      {/* little stem */}
      <path d="M6 26 L4.5 27.5" strokeWidth={FINE} />
    </svg>
  );
}

export function GheeIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* kalash / ghee pot body */}
      <path
        d="M8 14 C8 11.5 11.5 10 16 10 C20.5 10 24 11.5 24 14 C24 17 25.5 19 25.5 23 C25.5 26.5 21.5 28.5 16 28.5 C10.5 28.5 6.5 26.5 6.5 23 C6.5 19 8 17 8 14 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* rim collar */}
      <path d="M9.5 11.5 C11.5 10.3 13.5 9.8 16 9.8 C18.5 9.8 20.5 10.3 22.5 11.5" strokeWidth={FINE} />
      {/* side handles */}
      <path d="M8 16 C5.5 16 5 18.5 7 19.5" strokeWidth={FINE} />
      <path d="M24 16 C26.5 16 27 18.5 25 19.5" strokeWidth={FINE} />
      {/* lid */}
      <path d="M11 10 C11 7.5 13 6 16 6 C19 6 21 7.5 21 10" />
      {/* lid knob */}
      <path d="M16 6 V3.5" />
      <circle cx="16" cy="3" r="1.1" strokeWidth={FINE} />
      {/* ghee swirl / melt */}
      <path d="M11.5 20 C13.5 18.5 15 21 17 19.5 C18.5 18.5 19.5 20 20.5 19.5" strokeWidth={FINE} />
    </svg>
  );
}

export function OilIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* cap */}
      <path d="M14 3 H18 V6 H14 Z" fill="currentColor" fillOpacity={FILL_SOFT} />
      {/* neck */}
      <path d="M14.5 6 H17.5 V8.5 L19 11 V27 C19 28 18.2 28.5 17.2 28.5 H10.8 C9.8 28.5 9 28 9 27 V11 L10.5 8.5 V6" />
      {/* oil fill line + body shade */}
      <path
        d="M9 16 H19 V27 C19 28 18.2 28.5 17.2 28.5 H10.8 C9.8 28.5 9 28 9 27 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      <path d="M9 16 H19" strokeWidth={FINE} />
      {/* label band */}
      <path d="M9 19.5 H19" strokeWidth={FINE} />
      <path d="M11 22.5 H17" strokeWidth={FINE} />
      {/* olive sprig beside neck — stem + two small leaves */}
      <path d="M21.5 7 C23.5 9.5 24 12.5 22.8 15.5" strokeWidth={FINE} />
      <path d="M22.3 9.8 C23.4 8.9 24.8 9 25.6 10.1 C24.5 11 23.1 10.9 22.3 9.8 Z" strokeWidth={FINE} fill="currentColor" fillOpacity={FILL_FAINT} />
      <path d="M22.9 13 C24 12.1 25.4 12.2 26.2 13.3 C25.1 14.2 23.7 14.1 22.9 13 Z" strokeWidth={FINE} fill="currentColor" fillOpacity={FILL_FAINT} />
      {/* falling droplet */}
      <path d="M22 18.5 C23 19.8 23 21.4 21.7 21.4 C20.4 21.4 20.4 19.8 22 18.5 Z" strokeWidth={FINE} fill="currentColor" fillOpacity={FILL_SOFT} />
    </svg>
  );
}

export function GrainIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* central stalk */}
      <path d="M16 29 V8" />
      {/* paired grain leaves up the stalk */}
      <path d="M16 9.5 C13 10 11 8 11 5.5 C13.5 5.5 15.5 7 16 9.5 Z" fill="currentColor" fillOpacity={FILL_FAINT} />
      <path d="M16 9.5 C19 10 21 8 21 5.5 C18.5 5.5 16.5 7 16 9.5 Z" fill="currentColor" fillOpacity={FILL_FAINT} />
      <path d="M16 14.5 C12.5 15 10 12.8 10 9.8 C13 9.8 15.3 11.5 16 14.5 Z" fill="currentColor" fillOpacity={FILL_FAINT} />
      <path d="M16 14.5 C19.5 15 22 12.8 22 9.8 C19 9.8 16.7 11.5 16 14.5 Z" fill="currentColor" fillOpacity={FILL_FAINT} />
      <path d="M16 19.5 C12.5 20 10 17.8 10 14.8 C13 14.8 15.3 16.5 16 19.5 Z" />
      <path d="M16 19.5 C19.5 20 22 17.8 22 14.8 C19 14.8 16.7 16.5 16 19.5 Z" />
      {/* grain veins (fine) */}
      <path d="M13 7 L15 9" strokeWidth={FINE} />
      <path d="M19 7 L17 9" strokeWidth={FINE} />
      {/* twin leaves at base */}
      <path d="M16 24 C13.5 24 11.5 22.5 10.5 20.5 C13 20.5 15.5 21.5 16 24 Z" strokeWidth={FINE} />
      <path d="M16 24 C18.5 24 20.5 22.5 21.5 20.5 C19 20.5 16.5 21.5 16 24 Z" strokeWidth={FINE} />
    </svg>
  );
}

export function SeedlingIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* sprout stem */}
      <path d="M16 28 V15" />
      {/* two leaves */}
      <path
        d="M16 17 C12 17.5 8 14 7.5 8.5 C13 8.5 15.5 11.5 16 17 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      <path
        d="M16 15 C20 15.5 24 12 24.5 6.5 C19 6.5 16.5 9.5 16 15 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* leaf veins */}
      <path d="M16 17 C13.5 15.5 11.5 13.5 9.5 11" strokeWidth={FINE} />
      <path d="M16 15 C18.5 13.5 20.5 11.5 22.5 9" strokeWidth={FINE} />
      {/* soil rows */}
      <path d="M7 28 H25" />
      <path d="M9 25 H23" strokeWidth={FINE} />
      <path d="M11 25.5 V27.2" strokeWidth={FINE} />
      <path d="M16 26 V28" strokeWidth={FINE} />
      <path d="M21 25.5 V27.2" strokeWidth={FINE} />
    </svg>
  );
}

export function HoneyIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* jar lid */}
      <path d="M10 7.5 H22 V5.5 C22 4.7 21.3 4 20.5 4 H11.5 C10.7 4 10 4.7 10 5.5 Z" fill="currentColor" fillOpacity={FILL_SOFT} />
      {/* jar body */}
      <path
        d="M9 11 C9 9 10 7.5 12 7.5 H20 C22 7.5 23 9 23 11 V25.5 C23 27.4 21.4 28.5 19.5 28.5 H12.5 C10.6 28.5 9 27.4 9 25.5 Z"
      />
      {/* honey level */}
      <path
        d="M9 16 C12 14.5 14 17 16 16 C18 15 20 17 23 15.5 V25.5 C23 27.4 21.4 28.5 19.5 28.5 H12.5 C10.6 28.5 9 27.4 9 25.5 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* honeycomb hex accent on label */}
      <path d="M14 20 L16 19 L18 20 L18 22 L16 23 L14 22 Z" strokeWidth={FINE} />
      {/* dipper handle rising from the jar */}
      <path d="M16 7.5 V3" strokeWidth={FINE} />
      <ellipse cx="16" cy="3" rx="1.6" ry="1.1" strokeWidth={FINE} />
      <path d="M14.7 2.6 L17.3 3.4 M14.7 3.4 L17.3 2.6" strokeWidth={FINE} />
    </svg>
  );
}

export function SpiceIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* mortar bowl */}
      <path
        d="M6.5 17 H25.5 C25.5 23 21.5 27.5 16 27.5 C10.5 27.5 6.5 23 6.5 17 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* bowl rim */}
      <path d="M5 17 H27" />
      {/* pestle resting into the bowl */}
      <path d="M14 14 L22 6" />
      <path d="M21 7 C22.7 5.3 22.7 3.7 21.5 2.5 C20.3 1.3 18.7 1.3 17 3 Z" fill="currentColor" fillOpacity={FILL_SOFT} strokeWidth={FINE} />
      <path d="M16.5 12 C13.5 12.2 11.5 12.7 10.5 13.5" strokeWidth={FINE} />
      {/* seeds in the bowl */}
      <circle cx="12" cy="21" r="1.1" strokeWidth={FINE} />
      <circle cx="16" cy="22.5" r="1.1" strokeWidth={FINE} />
      <circle cx="20" cy="21" r="1.1" strokeWidth={FINE} />
      <circle cx="14" cy="24" r="0.9" strokeWidth={FINE} />
    </svg>
  );
}

export function MilkIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* cap */}
      <path d="M12.5 3 H19.5 V6 H12.5 Z" fill="currentColor" fillOpacity={FILL_SOFT} />
      {/* collar */}
      <path d="M11.5 6 H20.5" strokeWidth={FINE} />
      {/* bottle body with shoulders */}
      <path d="M12.5 6 V8.5 C12.5 9.5 10.5 11 10.5 14 V26 C10.5 27.4 11.6 28.5 13 28.5 H19 C20.4 28.5 21.5 27.4 21.5 26 V14 C21.5 11 19.5 9.5 19.5 8.5 V6" />
      {/* milk fill */}
      <path
        d="M10.5 16 H21.5 V26 C21.5 27.4 20.4 28.5 19 28.5 H13 C11.6 28.5 10.5 27.4 10.5 26 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      <path d="M10.5 16 H21.5" strokeWidth={FINE} />
      {/* gentle milk ripples */}
      <path d="M12 20 C14 21 16 19 19.5 20" strokeWidth={FINE} />
      {/* a single droplet above the collar */}
      <path d="M16 9.5 C17 10.8 17 12.2 15.7 12.2 C14.4 12.2 14.4 10.8 16 9.5 Z" strokeWidth={FINE} />
    </svg>
  );
}

export function FruitIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* mango body */}
      <path
        d="M19 8 C24 9 27 13 27 18 C27 24 22.5 28.5 16 28.5 C10.5 28.5 6 25 6 19.5 C6 14 9.5 10 14 9 C16 8.5 17.5 7.7 19 8 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* cheek highlight */}
      <path d="M10.5 17 C11 14 13 12 16 11.5" strokeWidth={FINE} />
      {/* stem */}
      <path d="M19 8 C19.5 5.5 18.5 4 16.8 3.5" />
      {/* leaf */}
      <path
        d="M19 6 C21.5 4.5 24 4.5 26 6 C24 7.5 21.5 7.8 19 6 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      <path d="M19.5 6 C21.5 5.8 23.5 5.9 25.3 6" strokeWidth={FINE} />
    </svg>
  );
}

export function GiftIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* basket / hamper body */}
      <path
        d="M5.5 16 H26.5 L24.5 27 C24.3 28 23.5 28.5 22.5 28.5 H9.5 C8.5 28.5 7.7 28 7.5 27 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* basket weave */}
      <path d="M9 20 H23" strokeWidth={FINE} />
      <path d="M8.7 24 H23.3" strokeWidth={FINE} />
      <path d="M12 16 L11.2 28.3" strokeWidth={FINE} />
      <path d="M16 16 V28.5" strokeWidth={FINE} />
      <path d="M20 16 L20.8 28.3" strokeWidth={FINE} />
      {/* produce poking out (bottles + a leaf) */}
      <path d="M11 16 V11 C11 10 11.7 9.5 12.5 9.5 C13.3 9.5 14 10 14 11 V16" strokeWidth={FINE} />
      <path d="M18 16 V12 C18 11 18.7 10.5 19.5 10.5 C20.3 10.5 21 11 21 12 V16" strokeWidth={FINE} />
      <path d="M14.5 16 C14 12 16 8.5 19 7.5 C19 11 17.5 14.5 14.5 16 Z" fill="currentColor" fillOpacity={FILL_FAINT} strokeWidth={FINE} />
      {/* rim */}
      <path d="M5 16 H27" />
    </svg>
  );
}

export function FlourIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* cloth bag body */}
      <path
        d="M8.5 13 C8.5 11 10 10 11.5 9.5 L13 7.5 H19 L20.5 9.5 C22 10 23.5 11 23.5 13 V25 C23.5 27.2 22 28.5 19.5 28.5 H12.5 C10 28.5 8.5 27.2 8.5 25 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* folded / tied top */}
      <path d="M13 7.5 C13 6 14.3 5 16 5 C17.7 5 19 6 19 7.5" />
      <path d="M13 7.5 L11.5 9.5 M19 7.5 L20.5 9.5" strokeWidth={FINE} />
      <path d="M12 9.7 C13.5 10.6 18.5 10.6 20 9.7" strokeWidth={FINE} />
      {/* label band */}
      <path d="M8.5 16 H23.5" strokeWidth={FINE} />
      <path d="M8.5 22 H23.5" strokeWidth={FINE} />
      {/* wheat sprig on the label */}
      <path d="M16 21 V17.5" strokeWidth={FINE} />
      <path d="M16 18.3 C14.7 18.4 13.9 17.6 13.9 16.4 C15.1 16.4 15.9 17.1 16 18.3 Z" strokeWidth={FINE} />
      <path d="M16 18.3 C17.3 18.4 18.1 17.6 18.1 16.4 C16.9 16.4 16.1 17.1 16 18.3 Z" strokeWidth={FINE} />
      <path d="M16 20.3 C14.7 20.4 13.9 19.6 13.9 18.4 C15.1 18.4 15.9 19.1 16 20.3 Z" strokeWidth={FINE} />
      <path d="M16 20.3 C17.3 20.4 18.1 19.6 18.1 18.4 C16.9 18.4 16.1 19.1 16 20.3 Z" strokeWidth={FINE} />
    </svg>
  );
}

export function NutsIcon({ className, size = 32 }: IconProps) {
  return (
    <svg {...baseProps(size)} className={cn(className)}>
      {/* almond (left) */}
      <path
        d="M9 8 C13 8.5 15.5 13 14.5 18.5 C14 21.5 12.5 23.5 10.5 23.5 C8 23.5 6 20.5 6 16.5 C6 12.5 7 9.5 9 8 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* almond seam + veins */}
      <path d="M9.5 9.5 C11 12.5 11.3 16.5 10.3 21.5" strokeWidth={FINE} />
      <path d="M10.3 13 L8 14 M10.6 16 L8.2 17 M10.5 19 L8.5 20" strokeWidth={FINE} />
      {/* cashew (right) */}
      <path
        d="M19 11 C23 9.5 26 11.5 26 15 C26 18.5 23 21 19.5 20 C21.5 18.5 22.5 16.5 22.5 15 C22.5 13.5 21 12.2 19 11 Z"
        fill="currentColor"
        fillOpacity={FILL_SOFT}
      />
      {/* cashew inner curve */}
      <path d="M20.5 12 C23 13 24 16 22 18.5" strokeWidth={FINE} />
    </svg>
  );
}

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
