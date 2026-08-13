"use client";

import { Section } from "../section";
import { Stagger, StaggerItem } from "../motion";
import { BrandIcon, type BrandIconName } from "@/components/ui/brand-icon";

/**
 * Why — the four promises, as a centred icon row.
 *
 * ── What changed and why ──────────────────────────────────────────────────
 *
 * This was four large numbered cards, each on its own gradient — forest, clay,
 * leaf, terracotta — with a blurred colour blob behind it. Four different
 * saturated surfaces stacked two-by-two meant the section competed with the
 * product rails on either side of it for attention, and the reader met four
 * separate designs before meeting four promises. The claims were carrying the
 * decoration rather than the other way round.
 *
 * One line of mark, one line of heading, one line of body, four times across.
 * Nothing tinted, nothing numbered, no card edges. On a page whose job is
 * selling groceries, the section that states what the company will not do
 * should be the quietest thing on it.
 *
 * ── The promises themselves are unchanged ─────────────────────────────────
 *
 * Same four claims, same numbers, same words — 42 partner farms, the Hyderabad
 * lab, the farmer price on the label. These are statements a regulator can hold
 * us to under the Consumer Protection Act, so they are not the sort of copy
 * that gets rewritten to fit a layout. The layout was fitted to them.
 */

interface Pillar {
  title: string;
  body: string;
  icon: BrandIconName;
}

const PILLARS: Pillar[] = [
  {
    icon: "tree",
    title: "Direct from farm",
    body: "We work with 42 partner farms across India. Every farmer is named, paid fairly, and shares in our growth.",
  },
  {
    icon: "churn",
    title: "Traditional processing",
    body: "Bilona-churned, cold-pressed, hand-finished. Never refined, hexane-extracted, or industrially heated.",
  },
  {
    icon: "checklist",
    title: "Tested every single lot",
    body: "Heavy metals, aflatoxin and adulterants, checked in our Hyderabad lab before a batch ships. Reports are public.",
  },
  {
    icon: "fairPrice",
    title: "Honest pricing",
    body: "What we pay the farmer is printed on every label. No marketing markup, no designer packaging tax.",
  },
];

export function Why() {
  return (
    <Section
      className="bg-ng-cream-mesh bg-ng-cream"
      align="center"
      eyebrow="Why we do this"
      heading={
        <>
          Why choose <em className="italic text-ng-leaf">Nutri Greenz?</em>
        </>
      }
    >
      <Stagger className="grid grid-cols-2 gap-x-6 gap-y-12 md:gap-x-8 lg:grid-cols-4 lg:gap-x-10">
        {PILLARS.map((p) => (
          <StaggerItem key={p.title}>
            <div className="flex flex-col items-center text-center">
              {/*
                Drawn at 64px on a light stroke. The mark is the only thing at
                this size in the whole section, so it does not need a disc, a
                tint or a shadow to be found — those were added when it was
                24px inside a badge and competing with a number twice its size.
              */}
              <BrandIcon
                name={p.icon}
                size={64}
                weight="line"
                className="text-ng-forest"
              />
              <h3 className="mt-6 font-display text-[clamp(19px,2.2vw,23px)] leading-tight text-ng-forest-deep">
                {p.title}
              </h3>
              <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-ng-ink-muted">
                {p.body}
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
