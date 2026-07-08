"use client";

import { useState } from "react";
import Link from "next/link";
import { Section } from "../section";
import { Input } from "../input";
import { Button } from "../button";
import { Reveal, Parallax, FloatIn, MagneticHover } from "../motion";

const SAMPLE_LOT = {
  code: "ANT-24-051",
  product: "Cold-Pressed Groundnut Oil — 1L",
  farm: "Mallika & Subbaiah Farm, Anantapur",
  pressed: "2026-04-18",
  tested: "2026-04-21 · Hyderabad lab",
  result: "All-clear: 0 adulterants · heavy metals within FSSAI limits",
};

export function Traceability() {
  const [code, setCode] = useState("");
  const [revealed, setRevealed] = useState(false);

  return (
    <Section className="bg-ng-forest-deep text-ng-cream relative overflow-hidden">
      {/* Base depth gradient — deep-forest with a faint cool-green glow so the
          dark band reads with dimension instead of a flat black-green. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% -12%, #123324 0%, transparent 60%), linear-gradient(168deg, #0A1F12 0%, #0E2717 52%, #14331F 100%)",
        }}
      />
      <Parallax speed={0.3} className="absolute inset-0 pointer-events-none">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 82% 16%, rgba(102,191,115,0.30), transparent 62%), radial-gradient(ellipse 55% 60% at 8% 92%, rgba(76,175,80,0.20), transparent 64%)",
          }}
        />
      </Parallax>

      {/* Parallaxed scan/lot-code motif */}
      <Parallax speed={0.22} className="absolute inset-0 pointer-events-none">
        <div aria-hidden className="absolute right-[6%] top-[14%] font-mono text-[clamp(60px,9vw,130px)] leading-none text-ng-leaf/[0.06] tracking-tighter select-none">
          ANT-24
        </div>
        <div aria-hidden className="absolute left-[4%] bottom-[10%] grid grid-cols-6 gap-1.5 opacity-[0.07]">
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-[2px] ${i % 3 === 0 ? "bg-ng-leaf" : "bg-ng-cream"}`} />
          ))}
        </div>
      </Parallax>

      <div className="relative z-10 grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-center">
        <div>
          <Reveal>
            <span className="ng-eyebrow text-ng-leaf">Traceability is the product</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-[1.02] text-ng-cream tracking-tight mt-3">
              Every jar carries a <em className="italic text-ng-leaf">six-character code.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="text-[16px] text-ng-cream/75 mt-5 leading-relaxed max-w-md">
              Scan the QR or type it below. See the farmer, the harvest date, the lab report, the pressing facility, and the kilometres travelled. No spin. No omissions.
            </p>
          </Reveal>

          <Reveal delay={0.24} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
            <Input
              placeholder="e.g. ANT-24-051"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-ng-cream/10 text-ng-cream placeholder:text-ng-cream/55 border-ng-cream/20"
              prefix={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h7v7h-7z" />
                </svg>
              }
            />
            <MagneticHover className="w-full sm:w-auto">
              <Button
                variant="gold"
                onClick={() => setRevealed(true)}
                className="w-full sm:w-auto"
              >
                Trace
              </Button>
            </MagneticHover>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="text-[12px] text-ng-cream/60 mt-3">
              Try the demo code{" "}
              <button
                type="button"
                onClick={() => { setCode(SAMPLE_LOT.code); setRevealed(true); }}
                className="underline text-ng-leaf hover:text-ng-cream transition-colors"
              >
                ANT-24-051
              </button>
            </p>
          </Reveal>
        </div>

        {/* Right — receipt card on a perspective stage */}
        <Reveal className="relative persp-1000">
          {/* Floating glass verified/lot chip */}
          <FloatIn delay={0.4} className="absolute -top-3 right-2 sm:right-4 z-20">
            <div className="glass rounded-full px-4 py-2 flex items-center gap-2 shadow-[var(--shadow-ng-glow)]">
              <span className="h-2 w-2 rounded-full bg-ng-success animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wide text-ng-forest-deep">Lab-verified lot</span>
            </div>
          </FloatIn>

          <div className="glass-dark group/card tilt-soft hover:[transform:none] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-3xl p-7 md:p-9 shadow-[var(--shadow-ng-float)] border border-ng-cream/15 backdrop-blur-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-ng-leaf font-semibold">Trace receipt</div>
                <div className="font-mono text-[24px] text-ng-cream mt-1">
                  {revealed ? SAMPLE_LOT.code : "— — — — — —"}
                </div>
              </div>
              <div className={`h-3 w-3 rounded-full transition-colors ${revealed ? "bg-ng-success animate-pulse" : "bg-ng-cream/20"}`} />
            </div>

            <dl className="space-y-4 text-[14px]">
              <Row label="Product" value={revealed ? SAMPLE_LOT.product : "—"} />
              <Row label="Partner farm" value={revealed ? SAMPLE_LOT.farm : "—"} />
              <Row label="Pressed on" value={revealed ? SAMPLE_LOT.pressed : "—"} />
              <Row label="Lab tested" value={revealed ? SAMPLE_LOT.tested : "—"} />
              <Row label="Result" value={revealed ? SAMPLE_LOT.result : "—"} highlight={revealed} />
            </dl>

            <div className="mt-7 pt-6 border-t border-ng-cream/10 flex items-center justify-between">
              <div className="text-[12px] text-ng-cream/60">Tamper-evident · blockchain-anchored</div>
              <Link href="/traceability" className="text-[13px] text-ng-leaf hover:text-ng-cream transition-colors">
                Full report →
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6 pb-3 border-b border-ng-cream/10 last:border-0">
      <dt className="text-[12px] uppercase tracking-wider text-ng-cream/60 shrink-0 sm:w-32">{label}</dt>
      <dd className={`text-left sm:text-right text-ng-cream font-display text-[14px] leading-snug ${highlight ? "text-ng-success font-medium" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
