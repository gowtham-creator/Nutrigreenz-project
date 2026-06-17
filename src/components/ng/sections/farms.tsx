"use client";

import Image from "next/image";
import Link from "next/link";
import { Section } from "../section";
import { Stagger, StaggerItem, Parallax, MagneticHover } from "../motion";
import { Button } from "../button";
import { FARMS } from "../data";
import { cn } from "@/lib/utils";

const FARM_IMAGES = [
  "/images/placeholder.svg",
  "/images/placeholder.svg",
  "/images/placeholder.svg",
];

export function Farms() {
  return (
    <Section
      className="relative overflow-hidden"
      eyebrow="The 42 names behind your jars"
      heading={<>Meet a few of our <em className="italic text-ng-leaf">partner farms.</em></>}
      description="We're not just sourcing — we're investing. Long-term agreements, soil-health programmes, transition financing."
    >
      {/* Parallaxed landscape blobs behind the grid */}
      <Parallax speed={0.35} className="absolute inset-0 -z-0 pointer-events-none">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(ellipse 45% 40% at 85% 8%, rgba(111,170,62,0.12), transparent 60%), radial-gradient(ellipse 50% 45% at 8% 95%, rgba(200,166,104,0.12), transparent 60%)",
          }}
        />
      </Parallax>

      <Stagger className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 persp-1400">
        {FARMS.map((farm, i) => (
          <StaggerItem key={farm.id} className="h-full">
            <article
              className={cn(
                "group relative flex h-full flex-col rounded-3xl overflow-hidden bg-ng-paper border border-ng-line-soft",
                "shadow-[var(--shadow-ng-card)] hover:shadow-[var(--shadow-ng-float)]",
                "hover:-translate-y-1.5",
                "will-change-transform transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={FARM_IMAGES[i] ?? FARM_IMAGES[0]}
                  alt={farm.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep/70 via-ng-forest-deep/10 to-transparent" />
                {/* Glass region chip top-left */}
                <div className="absolute top-4 left-4">
                  <span className="glass-strong rounded-full px-3 py-1.5 text-[11px] font-semibold text-ng-forest-deep">
                    {farm.region}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="text-[11px] font-medium text-ng-cream drop-shadow-[0_1px_2px_rgba(10,31,18,0.6)]">
                    Partner since {farm.partneredSince ? new Date(farm.partneredSince).getFullYear() : "—"}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-[22px] leading-tight text-ng-forest-deep">
                  {farm.name}
                </h3>
                {farm.hectares ? (
                  <p className="text-[13px] text-ng-ink-muted mt-1">
                    {farm.hectares} ha
                  </p>
                ) : null}

                <p className="text-[14px] text-ng-ink-muted mt-4 leading-relaxed line-clamp-3">
                  {farm.story}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {farm.practices.slice(0, 3).map((p) => (
                    <span key={p} className="text-[11px] px-2.5 py-1 rounded-full bg-ng-sage border border-ng-leaf-soft/60 text-ng-forest-deep capitalize">
                      {p}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-5 border-t border-ng-line-soft flex items-center justify-between">
                  <span className="text-[13px] text-ng-ink-soft">— {farm.farmerName}</span>
                  <Link
                    href={`/farms/${farm.id}`}
                    className="text-[13px] font-medium text-ng-forest hover:text-ng-leaf transition-colors"
                  >
                    Visit farm →
                  </Link>
                </div>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="relative z-10 flex justify-center mt-12">
        <MagneticHover>
          <Button variant="outline" size="lg" asChild>
            <Link href="/farms">See all 42 partner farms →</Link>
          </Button>
        </MagneticHover>
      </div>
    </Section>
  );
}
