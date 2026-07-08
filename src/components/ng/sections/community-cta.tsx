"use client";

import { Section } from "../section";
import { Button } from "../button";
import { Input } from "../input";
import { Reveal, Parallax, FloatIn, MagneticHover } from "../motion";

export function CommunityCTA() {
  return (
    <Section className="bg-ng-cream relative overflow-hidden">
      {/* Soft gradient wash — warm paper melting into a calm sage field so the
          harvest-letter panel sits on real depth instead of a flat sage block. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "linear-gradient(180deg, #FBFAF4 0%, #F1F4E9 46%, #E3EAD8 100%)",
        }}
      />
      {/* Base depth wash — cool green corner glow, warm forest anchor, no gold */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse 42% 52% at 0% 100%, rgba(31,77,46,0.16), transparent 60%), radial-gradient(ellipse 42% 52% at 100% 0%, rgba(102,191,115,0.18), transparent 60%)",
        }}
      />

      {/* Parallaxed depth blobs — drift slower than foreground for spatial depth */}
      <Parallax speed={0.4} className="pointer-events-none absolute inset-0 z-0">
        <div
          aria-hidden
          className="absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(102,191,115,0.28), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute right-0 bottom-0 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(181,134,47,0.12), transparent 70%)" }}
        />
      </Parallax>

      <div className="relative z-10 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <Reveal>
            <span className="ng-eyebrow text-ng-forest">The harvest letter</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-[1.02] text-ng-forest-deep tracking-tight mt-3">
              One letter a month. <em className="italic text-ng-leaf">Zero marketing.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="text-[16px] text-ng-ink-muted mt-5 leading-relaxed max-w-md">
              What&apos;s coming into season, recipes from our partner farms, lab reports we&apos;re proud of, and the occasional honest mistake. Written by humans. Sent on the new moon.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex items-center gap-6 text-[14px] text-ng-forest-deep">
              <Stat number="28k" label="readers" />
              <Stat number="48%" label="open rate" />
              <Stat number="0" label="ads, ever" />
            </div>
          </Reveal>
        </div>

        {/* Floating glass feature card */}
        <FloatIn delay={0.1}>
          <div className="relative rounded-3xl glass-strong ng-float p-7 md:p-9 shadow-[var(--shadow-ng-glow)]">
            <h3 className="font-display text-[22px] text-ng-forest-deep mb-5">
              Subscribe
            </h3>
            <form className="space-y-4">
              <Input label="Your name" placeholder="Anjali R." />
              <Input label="Email" type="email" placeholder="your@email.com" />
              <Input
                label="Favourite category (optional)"
                placeholder="Cold-pressed oils, ghee, honey…"
                hint="We'll tailor the letter to what you cook with most."
              />
              <div className="pt-2">
                <MagneticHover className="w-full">
                  <Button variant="primary" size="lg" fullWidth>
                    Subscribe to the harvest letter
                  </Button>
                </MagneticHover>
              </div>
              <p className="text-[12px] text-ng-ink-soft text-center">
                Unsubscribe in one click. We never sell your email.
              </p>
            </form>
          </div>
        </FloatIn>
      </div>
    </Section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[28px] leading-none text-ng-forest-deep">{number}</span>
      <span className="text-[12px] uppercase tracking-wider text-ng-ink-muted">{label}</span>
    </div>
  );
}
