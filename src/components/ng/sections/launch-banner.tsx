"use client";

import Link from "next/link";
import { Button } from "../button";
import { Logo } from "../logo";
import { Reveal, FloatIn, Parallax, MagneticHover } from "../motion";

/**
 * LaunchBanner — "NEW LAUNCH" promo banner.
 * Split layout: deep-forest copy panel (left) + product-image placeholder (right).
 * Sits between the Hero and Categories on the homepage.
 */
export function LaunchBanner() {
  return (
    <section className="relative py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <div className="relative grid overflow-hidden rounded-3xl shadow-[var(--shadow-ng-float)] md:grid-cols-2">
            {/* ── LEFT: deep-green copy panel ───────────────────────── */}
            <div className="relative isolate flex flex-col justify-center overflow-hidden bg-ng-forest px-7 py-12 sm:px-10 md:px-12 md:py-16 lg:px-14">
              {/* Faint botanical / leaf pattern */}
              <BotanicalPattern />
              {/* Warm gold + leaf radial wash */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-70"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 55% at 12% 0%, rgba(181,134,47,0.22), transparent 60%), radial-gradient(ellipse 60% 60% at 95% 100%, rgba(102,191,115,0.18), transparent 60%)",
                }}
              />
              {/* Parallaxed botanical depth blob — drifts slower behind the panel */}
              <Parallax speed={0.3} className="pointer-events-none absolute inset-0 -z-10">
                <div
                  aria-hidden
                  className="absolute -bottom-24 -left-16 h-[360px] w-[360px] rounded-full opacity-50 blur-3xl"
                  style={{ background: "radial-gradient(circle, rgba(102,191,115,0.30), transparent 70%)" }}
                />
              </Parallax>

              {/* "NEW LAUNCH" teardrop / pill badge — floats */}
              <FloatIn delay={0.15} className="absolute right-7 top-7 sm:right-10 md:right-12">
                <span className="inline-flex items-center gap-1.5 rounded-full rounded-tr-sm bg-ng-clay px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ng-soil shadow-[0_4px_14px_rgba(181,134,47,0.35)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-ng-soil/70" />
                  New launch
                </span>
              </FloatIn>

              <div className="relative z-10 max-w-md">
                <span className="ng-eyebrow text-ng-clay-light">This season&rsquo;s harvest</span>

                <h2 className="mt-3 font-display text-[clamp(38px,5.4vw,68px)] font-medium leading-[0.96] tracking-tight text-ng-cream">
                  Freshly pressed
                </h2>

                <p className="mt-3 font-display text-[clamp(18px,2.4vw,26px)] italic leading-snug text-ng-clay">
                  This season&rsquo;s cold-pressed oils are here.
                </p>

                <ul className="mt-6 space-y-2.5">
                  {[
                    "Single-origin and pressed within 7 days",
                    "Always bottled in glass, never plastic",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2.5 text-[15px] leading-snug text-ng-cream/80"
                    >
                      <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-ng-leaf" />
                      {line}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <MagneticHover>
                    <Button variant="gold" size="lg" asChild>
                      <Link href="/shop">Upgrade your oil</Link>
                    </Button>
                  </MagneticHover>
                </div>
              </div>
            </div>

            {/* ── RIGHT: product-image placeholder ──────────────────── */}
            <div className="group relative flex min-h-[320px] items-center justify-center bg-ng-cream p-7 sm:p-10 md:min-h-0 persp-1000">
              {/* Soft pattern wash behind the frame */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 70% at 50% 30%, rgba(178,199,178,0.45), transparent 65%)",
                }}
              />
              <BotanicalPattern tone="cream" className="opacity-[0.06]" />

              {/* Framed slot for the future hero shot — floats with a gentle bob + soft tilt */}
              <FloatIn delay={0.1} className="relative z-10 h-full w-full max-w-md">
                <div className="h-full w-full tilt-soft transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] [transform-style:preserve-3d] group-hover:[transform:rotateX(0deg)_rotateY(0deg)]">
                  <div className="ng-float flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ng-clay/35 bg-ng-paper/60 px-8 py-12 text-center backdrop-blur-sm">
                    <span className="absolute right-3 top-3 rounded-full bg-ng-cream-deep px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ng-ink-soft">
                      Coming soon
                    </span>
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-ng-cream shadow-[var(--shadow-ng-soft)]">
                      {/* Decorative watermark, not a mark assertion — the header already carries it. */}
              <Logo variant="mark" tone="forest" showTrademark={false} className="h-14 w-14 opacity-90" />
                    </div>
                    <p className="font-display text-[17px] leading-tight text-ng-forest-deep/80">
                      Product feature image
                    </p>
                    <p className="max-w-[18rem] text-[12px] leading-relaxed text-ng-ink-soft">
                      A studio shot of the new cold-pressed range lands here.
                    </p>
                  </div>
                </div>
              </FloatIn>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Subtle repeating leaf-branch motif used to texture the panels. */
function BotanicalPattern({
  tone = "forest",
  className,
}: {
  tone?: "forest" | "cream";
  className?: string;
}) {
  const stroke = tone === "forest" ? "#66BF73" : "#14331F";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 ${
        tone === "forest" ? "opacity-[0.07]" : ""
      } ${className ?? ""}`}
    >
      <svg
        width="100%"
        height="100%"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id={`ng-leaf-${tone}`}
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(8)"
          >
            <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
              <path d="M30 100 C30 70 30 40 30 20" />
              <path d="M30 70 C12 64 4 50 4 30" />
              <path d="M30 60 C48 54 56 40 56 20" />
              <path d="M30 44 C16 39 9 28 9 12" />
              <path d="M90 110 C90 86 90 60 90 44" />
              <path d="M90 84 C106 78 112 66 112 50" />
              <path d="M90 74 C74 69 68 57 68 41" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ng-leaf-${tone})`} />
      </svg>
    </div>
  );
}

function Leaf({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
