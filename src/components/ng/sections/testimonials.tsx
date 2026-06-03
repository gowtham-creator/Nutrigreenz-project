"use client";

import { Section } from "../section";
import { Stars } from "../stars";
import { Stagger, StaggerItem, Parallax, FloatIn } from "../motion";
import { TESTIMONIALS } from "../data";

export function Testimonials() {
  return (
    <Section
      align="center"
      className="overflow-hidden"
      eyebrow="From our pantry families"
      heading={<>What 12,400+ households <em className="italic text-ng-leaf">are saying.</em></>}
      description="Verified reviews, every one. No filters, no edits."
    >
      {/* Depth backdrop — drifts slower than foreground */}
      <Parallax
        speed={0.3}
        className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 z-0"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 36% 44% at 18% 24%, rgba(181,134,47,0.12), transparent 62%), radial-gradient(ellipse 40% 50% at 84% 78%, rgba(102,191,115,0.12), transparent 64%)",
          }}
        />
        {/* Oversized floating quotation mark, far behind content */}
        <div
          aria-hidden
          className="absolute right-[6%] top-[2%] font-display text-[clamp(180px,26vw,360px)] leading-none text-ng-clay/10 select-none"
        >
          &rdquo;
        </div>
      </Parallax>

      {/* Floating verified-rating chip */}
      <div className="relative z-10 mb-8 flex justify-center">
        <FloatIn delay={0.1}>
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-ng-forest-deep shadow-[var(--shadow-ng-card)]">
            <Stars rating={5} size="sm" />
            4.9 / 5 across 12,400+ verified reviews
          </span>
        </FloatIn>
      </div>

      <Stagger className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-2 persp-1000">
        {TESTIMONIALS.map((t) => (
          <StaggerItem key={t.id}>
            <figure className="group/card relative h-full rounded-3xl glass ng-float p-7 md:p-8 tilt-soft transition-transform duration-500 ease-out [transform-style:preserve-3d] hover:[transform:rotateX(0deg)_rotateY(0deg)]">
              {/* Big quote mark */}
              <div
                aria-hidden
                className="absolute -top-3 left-7 font-display text-[88px] leading-none text-ng-clay/40 pointer-events-none select-none"
              >
                &ldquo;
              </div>
              <div className="relative">
                <Stars rating={t.rating} size="sm" />
                <blockquote className="font-display text-[20px] leading-[1.35] text-ng-forest-deep mt-4">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 pt-5 border-t border-ng-line-soft flex items-center justify-between">
                  <div>
                    <div className="font-display text-[15px] text-ng-ink">{t.name}</div>
                    <div className="text-[12px] text-ng-ink-soft">{t.location}</div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-ng-success/10 text-ng-success font-semibold">
                    Verified
                  </span>
                </figcaption>
              </div>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
