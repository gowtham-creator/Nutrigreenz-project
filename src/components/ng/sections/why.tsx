"use client";

import { Section } from "../section";
import { Stagger, StaggerItem } from "../motion";
import { BrandName } from "../brand-name";
import { PromiseIcon, type PromiseIconName } from "@/components/ui/promise-icon";

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
  icon: PromiseIconName;
}

/*
 * Icon order is the supplied order, left to right: trees, press, checked
 * document, tractor.
 *
 * The fourth is worth a note. A tractor over "Honest pricing" is the one pairing
 * here that does not describe its own card — the mark says machinery and the
 * heading says money. It is what was asked for and it is what ships; flagging it
 * only so the mismatch is a decision on the record rather than something that
 * looks like a wiring mistake later.
 */
const PILLARS: Pillar[] = [
  {
    icon: "tree",
    title: "Direct from farm",
    body: "We work with 42 partner farms across India. Every farmer is named, paid fairly, and shares in our growth.",
  },
  {
    icon: "press",
    title: "Traditional processing",
    body: "Bilona-churned, cold-pressed, hand-finished. Never refined, hexane-extracted, or industrially heated.",
  },
  {
    icon: "verified",
    title: "Tested every single lot",
    body: "Heavy metals, aflatoxin and adulterants, checked in our Hyderabad lab before a batch ships. Reports are public.",
  },
  {
    icon: "tractor",
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
          Why choose <BrandName />?
        </>
      }
    >
      <Stagger className="grid grid-cols-2 gap-x-6 gap-y-12 md:gap-x-8 lg:grid-cols-4 lg:gap-x-10">
        {PILLARS.map((p) => (
          <StaggerItem key={p.title}>
            <div className="flex flex-col items-center text-center">
              {/*
                Drawn bare. The mark is the only thing at this size in the whole
                section, so it needs no disc, tint or shadow to be found — those
                were added back when it was 24px inside a badge, competing with
                a number twice its size.

                72px, up from 64. These marks carry more internal detail than
                the single-object Lucide glyphs they replace — two trees, a
                press with a chute, a document with a tick — and at 64 the finer
                parts closed up. The row has the vertical space for it.
              */}
              <PromiseIcon name={p.icon} size={72} className="text-ng-forest-deep" />
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
