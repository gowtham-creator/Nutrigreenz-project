"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "../button";
import { Icon } from "@/components/ui/icon";
import { Reveal, FloatIn, Parallax, MagneticHover } from "../motion";
import { PRODUCE_ICONS } from "../produce-icons";

const COUPON = "HARVEST20";

/**
 * OfferBanner — the homepage "deal" banner (standard promo-banner pattern).
 * Bold headline + sub-line, a big "Get Flat 20% Off", a dashed copy-to-clipboard
 * coupon pill, and a CTA to /shop. Forest/gold treatment decorated with produce
 * icons — no external photos. Mobile-first, no overflow at 390.
 */
export function OfferBanner() {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
    } catch {
      /* clipboard may be unavailable — still flag success for UX parity */
    }
    setCopied(true);
    toast.success("Code copied", { description: `Use “${COUPON}” at checkout` });
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="offer-banner" className="relative py-8 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-3xl bg-ng-forest shadow-[var(--shadow-ng-float)]">
            {/* Warm gold + leaf radial wash */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-80"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 8% 0%, rgba(181,134,47,0.30), transparent 60%), radial-gradient(ellipse 65% 70% at 96% 100%, rgba(102,191,115,0.22), transparent 60%)",
              }}
            />
            {/* Parallaxed depth blob */}
            <Parallax speed={0.3} className="pointer-events-none absolute inset-0 -z-10">
              <div
                aria-hidden
                className="absolute -bottom-24 right-[-10%] h-[380px] w-[380px] rounded-full opacity-50 blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(102,191,115,0.32), transparent 70%)" }}
              />
            </Parallax>

            {/* Floating produce-icon decoration (desktop only, decorative) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 hidden md:block">
              <FloatIn delay={0.1} className="absolute right-10 top-8 text-ng-leaf/25">
                <PRODUCE_ICONS.oil size={86} />
              </FloatIn>
              <FloatIn delay={0.35} className="absolute right-[34%] bottom-6 text-ng-clay/25">
                <PRODUCE_ICONS.honey size={64} />
              </FloatIn>
              <FloatIn delay={0.55} className="absolute right-[18%] top-1/2 text-ng-leaf/20">
                <PRODUCE_ICONS.leaf size={52} />
              </FloatIn>
            </div>

            <div className="relative z-10 grid items-center gap-7 px-7 py-10 sm:px-10 md:grid-cols-[1.35fr_1fr] md:px-12 md:py-14">
              {/* ── Copy ─────────────────────────────────────────────── */}
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-ng-clay/95 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ng-soil shadow-[0_4px_14px_rgba(181,134,47,0.35)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ng-soil/80" />
                  Harvest Sale is Live
                </span>

                <h2 className="mt-4 font-display text-[clamp(30px,5vw,56px)] font-medium leading-[0.98] tracking-tight text-ng-cream">
                  Get Flat <span className="text-ng-clay">20% Off</span>
                  <br className="hidden sm:block" /> the whole harvest.
                </h2>

                <p className="mt-3 text-[15px] leading-relaxed text-ng-cream/80 md:text-[16px]">
                  Cold-pressed oils, bilona ghee, raw honey &amp; stone-ground staples — pressed
                  fresh and lab-tested. Stock the pantry while the sale lasts.
                </p>

                <div className="mt-7 flex flex-col items-start gap-3.5 sm:flex-row sm:items-center">
                  <MagneticHover>
                    <Button variant="gold" size="lg" asChild>
                      <Link href="/shop">
                        Shop the sale
                        <Icon name="arrow-right-linear" size={18} />
                      </Link>
                    </Button>
                  </MagneticHover>

                  {/* Dashed coupon pill — click to copy */}
                  <button
                    type="button"
                    onClick={copyCode}
                    aria-label={`Copy coupon code ${COUPON}`}
                    className="group inline-flex items-center gap-2.5 rounded-full border border-dashed border-ng-clay/70 bg-ng-paper/10 px-4 py-2.5 text-ng-cream backdrop-blur-sm transition-colors hover:bg-ng-paper/15"
                  >
                    <span className="text-[12px] uppercase tracking-[0.14em] text-ng-cream/70">Use code</span>
                    <span className="font-mono text-[15px] font-semibold tracking-wide text-ng-clay">{COUPON}</span>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ng-cream/12 text-ng-cream transition-transform group-active:scale-90">
                      <Icon name={copied ? "check-circle-bold" : "copy-linear"} size={15} />
                    </span>
                  </button>
                </div>
              </div>

              {/* ── Big discount medallion ───────────────────────────── */}
              <FloatIn delay={0.15} className="hidden justify-self-center md:block">
                <div className="relative grid h-44 w-44 place-items-center rounded-full border border-ng-clay/40 bg-ng-forest-deep/40 text-center shadow-[inset_0_2px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm lg:h-52 lg:w-52">
                  <div
                    aria-hidden
                    className="absolute inset-2 rounded-full border border-dashed border-ng-cream/25"
                  />
                  <div>
                    <span className="block font-display text-[clamp(40px,6vw,64px)] font-semibold leading-none text-ng-clay">
                      20%
                    </span>
                    <span className="mt-1 block text-[12px] font-semibold uppercase tracking-[0.22em] text-ng-cream/80">
                      Off
                    </span>
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
