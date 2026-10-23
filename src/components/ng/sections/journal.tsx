"use client";

import Image from "next/image";
import Link from "next/link";
import { Section } from "../section";
import { Stagger, StaggerItem, Parallax } from "../motion";
import { JOURNAL } from "../data";

const CATEGORY_TONE: Record<string, string> = {
  science: "bg-ng-forest text-ng-cream",
  "field-notes": "bg-ng-clay text-ng-forest-deep",
  recipes: "bg-ng-terracotta text-white",
  guides: "bg-ng-leaf text-ng-forest-deep",
};

export function Journal() {
  return (
    <Section
      className="overflow-hidden"
      eyebrow="From the field"
      heading={<>The <em className="italic text-ng-leaf">Nutri Greenz Journal.</em></>}
      description="Long-form reporting from the farms, the kitchen, and the lab. Updated every fortnight."
    >
      {/* Depth backdrop — drifts slower than the cards */}
      <Parallax
        speed={0.25}
        className="pointer-events-none absolute inset-x-0 -top-20 bottom-0 z-0"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 34% 42% at 10% 18%, rgba(102,191,115,0.10), transparent 60%), radial-gradient(ellipse 38% 46% at 92% 88%, rgba(178,199,178,0.18), transparent 64%)",
          }}
        />
      </Parallax>

      <Stagger className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 persp-1400">
        {JOURNAL.map((article) => (
          <StaggerItem key={article.id} className="h-full">
            <Link
              href={`/journal/${article.slug}`}
              className="group flex flex-col h-full rounded-2xl bg-ng-paper border border-ng-line-soft overflow-hidden ng-float transition-transform duration-500"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-ng-cream-deep">
                {/* Cover gets a gentle parallax drift within its frame */}
                <Parallax speed={0.18} className="absolute inset-0 -top-[8%] -bottom-[8%] h-[116%]">
                  <Image
                    src={article.cover}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                </Parallax>
                <div className="absolute top-3 left-3 z-10">
                  <span className={`text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${CATEGORY_TONE[article.category] ?? "bg-ng-ink text-ng-cream"}`}>
                    {article.category.replace("-", " ")}
                  </span>
                </div>
              </div>
              <div className="flex flex-col flex-1 p-5">
                <h3 className="font-display text-[18px] leading-tight text-ng-forest-deep group-hover:text-ng-leaf transition-colors">
                  {article.title}
                </h3>
                <p className="text-[13px] text-ng-ink-muted mt-2 leading-relaxed line-clamp-3 flex-1">
                  {article.excerpt}
                </p>
                <div className="mt-4 pt-4 border-t border-ng-line-soft flex items-center justify-between text-[12px] text-ng-ink-soft">
                  <span>{new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
                  <span className="ng-magnetic inline-flex items-center gap-1 font-semibold text-ng-forest group-hover:text-ng-leaf">
                    Read
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">&rarr;</span>
                  </span>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
