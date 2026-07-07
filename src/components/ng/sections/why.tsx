"use client";

import { Section } from "../section";
import { Stagger, StaggerItem } from "../motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type Variant = "forest" | "clay" | "leaf" | "terracotta";

interface Pillar {
  num: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: string;
  variant: Variant;
}

const PILLARS: Pillar[] = [
  {
    num: "01",
    eyebrow: "Soil-up",
    title: "Direct from farm. No middlemen.",
    body: "We work with 42 partner farms across India. Every farmer is named, paid fairly, and shares in our growth.",
    icon: "leaf-bold",
    variant: "forest",
  },
  {
    num: "02",
    eyebrow: "Slow methods",
    title: "Bilona, cold-press, hand-churn.",
    body: "We never use refined, hexane-extracted, or industrially heated processes. The old ways are the right ways.",
    icon: "bottle-bold",
    variant: "clay",
  },
  {
    num: "03",
    eyebrow: "Lab-tested every lot",
    title: "Heavy metals · aflatoxin · adulterants.",
    body: "Every batch goes through our Hyderabad lab before it ships. Test reports are public — scan the lot code.",
    icon: "shield-check-bold",
    variant: "leaf",
  },
  {
    num: "04",
    eyebrow: "Honest pricing",
    title: "What we pay the farmer is on every label.",
    body: "No marketing markup. No designer packaging tax. Just the cost to grow it well, plus a fair operating margin.",
    icon: "tag-price-bold",
    variant: "terracotta",
  },
];

interface Treatment {
  /** Card surface (background + border). */
  card: string;
  /** Decorative blurred blob colour. */
  blob: string;
  /** Numbered badge / icon chip. */
  badge: string;
  /** Eyebrow accent text. */
  eyebrow: string;
  /** Big serif title text. */
  title: string;
  /** Body copy text. */
  body: string;
  /** Hover shadow. */
  shadow: string;
}

const TREATMENTS: Record<Variant, Treatment> = {
  // 01 — bold filled hero card: deep forest gradient, cream text, soft leaf inner glow.
  forest: {
    card: "bg-gradient-to-br from-ng-forest via-ng-forest to-ng-forest-deep border-ng-forest-deep/70 ring-1 ring-inset ring-ng-leaf/12",
    blob: "bg-ng-leaf/25",
    badge: "bg-ng-leaf text-ng-forest-deep shadow-[0_8px_24px_-8px_rgba(102,191,115,0.7)]",
    eyebrow: "text-ng-leaf",
    title: "text-ng-cream",
    body: "text-ng-cream/75",
    shadow: "hover:shadow-[0_28px_60px_-24px_rgba(10,31,18,0.55)]",
  },
  // 02 — warm gold / clay block: deliberate tint with a firm edge, not a wash.
  clay: {
    card: "bg-gradient-to-br from-ng-clay/[0.16] via-ng-cream-deep/70 to-ng-cream-deep border-ng-clay/40 ring-1 ring-inset ring-ng-clay/12",
    blob: "bg-ng-clay/28",
    badge: "bg-ng-clay text-ng-cream shadow-[0_8px_24px_-8px_rgba(181,134,47,0.6)]",
    eyebrow: "text-ng-clay-deep",
    title: "text-ng-forest-deep",
    body: "text-ng-ink",
    shadow: "hover:shadow-[0_28px_60px_-24px_rgba(138,100,32,0.4)]",
  },
  // 03 — fresh leaf green block, saturated enough to read as a designed surface.
  leaf: {
    card: "bg-gradient-to-br from-ng-leaf/28 via-ng-sage/35 to-ng-cream-deep/55 border-ng-forest-soft/30 ring-1 ring-inset ring-ng-leaf/15",
    blob: "bg-ng-leaf/40",
    badge: "bg-ng-forest-soft text-ng-cream shadow-[0_8px_24px_-8px_rgba(31,77,46,0.6)]",
    eyebrow: "text-ng-forest-soft",
    title: "text-ng-forest",
    body: "text-ng-ink",
    shadow: "hover:shadow-[0_28px_60px_-24px_rgba(31,77,46,0.4)]",
  },
  // 04 — warm terracotta block: clay-free warmth so gold stays sparing.
  terracotta: {
    card: "bg-gradient-to-br from-ng-terracotta/20 via-ng-cream-deep/60 to-ng-cream-deep border-ng-terracotta/35 ring-1 ring-inset ring-ng-terracotta/12",
    blob: "bg-ng-terracotta/30",
    badge: "bg-ng-terracotta text-ng-cream shadow-[0_8px_24px_-8px_rgba(199,77,51,0.6)]",
    eyebrow: "text-ng-terracotta",
    title: "text-ng-terracotta",
    body: "text-ng-ink",
    shadow: "hover:shadow-[0_28px_60px_-24px_rgba(199,77,51,0.4)]",
  },
};

export function Why() {
  return (
    <Section
      className="bg-ng-cream-mesh bg-ng-cream"
      eyebrow="Why we do this"
      heading={<>Four promises we put <em className="italic text-ng-leaf">in writing.</em></>}
      description="No tagline can replace the practice. Here's exactly how we operate, in plain language."
    >
      <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {PILLARS.map((p) => {
          const t = TREATMENTS[p.variant];
          return (
            <StaggerItem key={p.title} className="h-full">
              <article
                className={cn(
                  "group relative h-full rounded-3xl border p-7 md:p-9 overflow-hidden",
                  "transition-all duration-500 hover:-translate-y-1.5",
                  t.card,
                  t.shadow,
                )}
              >
                {/* Colour blob */}
                <div
                  className={cn(
                    "pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full opacity-70 blur-3xl transition-all duration-700 group-hover:opacity-100 group-hover:scale-110",
                    t.blob,
                  )}
                />
                <div className="relative">
                  {/* Badge row: numbered icon chip + big number */}
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl",
                        t.badge,
                      )}
                    >
                      <Icon name={p.icon} size={24} />
                    </span>
                    <span
                      className={cn(
                        "font-display text-4xl md:text-5xl leading-none tabular-nums opacity-40",
                        t.title,
                      )}
                    >
                      {p.num}
                    </span>
                  </div>

                  <span className={cn("ng-eyebrow mt-6 block", t.eyebrow)}>
                    {p.eyebrow}
                  </span>
                  <h3
                    className={cn(
                      "font-display text-[clamp(23px,2.9vw,31px)] leading-tight mt-2.5",
                      t.title,
                    )}
                  >
                    {p.title}
                  </h3>
                  <p className={cn("text-[15px] mt-3 leading-relaxed max-w-md", t.body)}>
                    {p.body}
                  </p>
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}
