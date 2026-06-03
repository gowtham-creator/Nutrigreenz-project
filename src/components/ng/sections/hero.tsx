"use client";

import Link from "next/link";
import { Button } from "../button";
import { Stars } from "../stars";
import { Logo } from "../logo";
import { Reveal, FloatIn, Parallax, MagneticHover } from "../motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ng-cream-mesh bg-ng-cream isolate">
      {/* Aurora background */}
      <div aria-hidden className="absolute inset-0 -z-10 aurora opacity-60" />

      {/* Deep parallaxed depth backdrops — drift slower than the foreground */}
      <Parallax speed={0.25} className="pointer-events-none absolute inset-0 -z-10">
        <div
          aria-hidden
          className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--ng-leaf-soft), transparent 70%)" }}
        />
      </Parallax>
      <Parallax speed={0.4} className="pointer-events-none absolute inset-0 -z-10">
        <div
          aria-hidden
          className="absolute -bottom-40 -right-20 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--ng-clay), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute top-1/3 left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--ng-sage), transparent 70%)" }}
        />
      </Parallax>

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8 pt-16 pb-24 md:pt-24 md:pb-32 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        {/* Left — copy */}
        <div className="relative space-y-7 max-w-xl">
          <Reveal>
            <span className="ng-eyebrow text-ng-forest">Born in soil · Built for tomorrow</span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="font-display text-[clamp(44px,7vw,86px)] leading-[0.95] tracking-tight text-ng-forest-deep">
              Food the way <em className="italic text-ng-leaf">your grandmother</em> would recognise.
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-[17px] leading-relaxed text-ng-ink-muted max-w-md">
              Cold-pressed oils, bilona-churned A2 ghee, single-origin honey, heritage millets — sourced direct from forty-two partner farms across India. No middlemen. Every lot lab-tested. Every farmer paid fairly.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <MagneticHover>
                <Button variant="primary" size="lg" asChild>
                  <Link href="/shop">Shop the harvest</Link>
                </Button>
              </MagneticHover>
              <MagneticHover>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/traceability">Trace a lot →</Link>
                </Button>
              </MagneticHover>
            </div>
          </Reveal>

          {/* Trust strip */}
          <Reveal delay={0.2}>
            <div className="flex items-center gap-6 pt-6 border-t border-ng-line-soft">
              <div className="flex items-center gap-2">
                <Stars rating={4.8} size="sm" />
                <span className="text-[13px] text-ng-ink-muted">4.8 · 12,400+ reviews</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[13px] text-ng-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-ng-leaf" />
                FSSAI · ISO 22000
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right — floating product composition (the antigravity moment) */}
        <FloatIn className="group relative h-[480px] md:h-[560px] persp-1000">
          {/* tilt-soft 3D stage that eases toward flat on hover */}
          <div className="relative h-full w-full tilt-soft transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] [transform-style:preserve-3d] group-hover:[transform:rotateX(0deg)_rotateY(0deg)]">
            {/* Center hero product */}
            <div className="absolute inset-x-8 inset-y-0 rounded-[36px] overflow-hidden ng-float shadow-[var(--shadow-ng-float)] border border-ng-line-soft">
              <div className="ng-img-fallback h-full w-full flex-col gap-5">
                <Logo variant="mark" tone="forest" className="h-28 w-28 opacity-90" />
                <span className="font-display text-[15px] font-medium tracking-wide text-ng-forest-deep/70">
                  Farm-fresh · fully traceable
                </span>
              </div>
            </div>

            {/* Floating glass chips — staggered FloatIn bobs */}
            <FloatIn delay={0.2} className="absolute -left-3 top-12 max-w-[220px]">
              <div className="glass-strong rounded-2xl px-4 py-3 shadow-[var(--shadow-ng-card)]">
                <div className="text-[11px] uppercase tracking-wider text-ng-forest font-semibold">Lot · NG-24-051</div>
                <div className="font-display text-[15px] text-ng-ink leading-tight mt-1">
                  Anantapur · groundnut · pressed Apr 18
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ng-ink-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-ng-success" />
                  Lab-tested · 0 adulterants
                </div>
              </div>
            </FloatIn>

            <FloatIn delay={0.45} className="absolute -right-2 bottom-16 max-w-[240px]">
              <div className="glass-strong rounded-2xl px-4 py-3 shadow-[var(--shadow-ng-card)]">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-ng-clay/30 grid place-items-center text-ng-forest-deep font-display text-[16px]">
                    S
                  </div>
                  <div>
                    <div className="font-display text-[15px] text-ng-ink leading-tight">K. Subbaiah</div>
                    <div className="text-[11px] text-ng-ink-muted">Partner since 2019 · 14 ha</div>
                  </div>
                </div>
              </div>
            </FloatIn>

            <FloatIn delay={0.7} className="absolute -right-6 top-6">
              <div className="glass-strong rounded-full px-4 py-2 shadow-[var(--shadow-ng-card)]">
                <span className="text-[12px] font-semibold text-ng-forest-deep">A2 · Bilona</span>
              </div>
            </FloatIn>
          </div>
        </FloatIn>
      </div>
    </section>
  );
}
