"use client";

import { Section } from "../section";
import { Stars } from "../stars";
import { Stagger, StaggerItem, Parallax } from "../motion";
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

      <Stagger className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-2 persp-1000">
        {TESTIMONIALS.map((t) => (
          <StaggerItem key={t.id} className="h-full">
            <figure className="group/card relative flex h-full flex-col rounded-3xl glass ng-float p-6 md:p-8">
              {/* Big quote mark */}
              <div
                aria-hidden
                className="absolute -top-1 left-7 font-display text-[64px] leading-none text-ng-clay/40 pointer-events-none select-none"
              >
                &ldquo;
              </div>
              <div className="relative flex flex-1 flex-col pt-2">
                <Stars rating={t.rating} size="sm" />
                <blockquote className="font-display text-[17px] md:text-[20px] leading-[1.45] md:leading-[1.35] text-ng-forest-deep mt-4">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-auto pt-5 border-t border-ng-line-soft flex items-center justify-between">
                  <div>
                    <div className="font-display text-[15px] text-ng-ink">{t.name}</div>
                    <div className="text-[12px] text-ng-ink-soft">{t.location}</div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-ng-success/15 text-ng-forest-deep font-semibold">
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
