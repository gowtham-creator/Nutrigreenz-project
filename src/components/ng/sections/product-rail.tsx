"use client";

import { useRef } from "react";
import Link from "next/link";
import { Section } from "../section";
import { ProductCard } from "../product-card";
import { Button } from "../button";
import { Stagger, StaggerItem, Parallax } from "../motion";
import type { ProductCard as ProductCardType } from "@/types/nutrigreenz";

interface Props {
  eyebrow?: string;
  heading: React.ReactNode;
  description?: string;
  products: ProductCardType[];
  ctaLabel?: string;
  ctaHref?: string;
}

export function ProductRail({ eyebrow, heading, description, products, ctaLabel = "Shop all", ctaHref = "/shop" }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <Section className="relative overflow-hidden" eyebrow={eyebrow} heading={heading} description={description}>
      {/* Parallaxed background accent behind the rail */}
      <Parallax speed={0.28} className="absolute inset-0 -z-0 pointer-events-none">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(ellipse 40% 55% at 92% 30%, rgba(184,212,154,0.18), transparent 60%), radial-gradient(ellipse 45% 50% at 4% 80%, rgba(200,166,104,0.10), transparent 60%)",
          }}
        />
      </Parallax>

      <div className="relative z-10 -mt-4 flex items-center justify-end gap-2 mb-5">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ctaHref}>{ctaLabel} →</Link>
        </Button>
        <button
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-ng-line hover:bg-ng-sage/40 transition-colors text-ng-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-ng-line hover:bg-ng-sage/40 transition-colors text-ng-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div
        ref={scrollRef}
        className="relative z-10 overflow-x-auto pb-4 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <Stagger className="flex gap-5">
          {products.map((p) => (
            <StaggerItem
              key={p.id}
              className="snap-start shrink-0 w-[280px] md:w-[300px] h-full will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:[transform:perspective(1000px)_rotateX(2deg)_translateY(-6px)]"
            >
              <ProductCard product={p} className="h-full" />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
