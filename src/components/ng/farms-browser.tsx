"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip } from "@/components/ng/chip";
import { Reveal } from "@/components/ng/motion";
import type { FarmRecord } from "@/lib/content";

/**
 * The Our farms grid with working filters.
 *
 * The region and practice chips used to be fixed labels with nothing behind
 * them. They are now built from the farms themselves: the state is the last
 * part of each farm's region ("Anantapur, Andhra Pradesh" → Andhra Pradesh),
 * and the practices are every practice any farm lists. Both filters combine.
 */

const ALL_REGIONS = "All regions";
const ALL_PRACTICES = "All practices";

/** "Anantapur, Andhra Pradesh" → "Andhra Pradesh". */
export function stateOf(region: string): string {
  const parts = region.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function FarmsBrowser({ farms }: { farms: FarmRecord[] }) {
  const [region, setRegion] = useState(ALL_REGIONS);
  const [practice, setPractice] = useState(ALL_PRACTICES);

  const regions = useMemo(
    () => [ALL_REGIONS, ...[...new Set(farms.map((f) => stateOf(f.region)).filter(Boolean))].sort()],
    [farms],
  );
  const practices = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of farms) for (const p of f.practices) {
      const key = p.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, titleCase(p.trim()));
    }
    return [ALL_PRACTICES, ...[...seen.values()].sort()];
  }, [farms]);

  const shown = farms.filter(
    (f) =>
      (region === ALL_REGIONS || stateOf(f.region) === region) &&
      (practice === ALL_PRACTICES || f.practices.some((p) => p.trim().toLowerCase() === practice.toLowerCase())),
  );
  const filtered = region !== ALL_REGIONS || practice !== ALL_PRACTICES;

  return (
    <>
      {/* Filters */}
      <div className="border-b border-ng-line-soft bg-ng-paper z-30 glass-strong md:sticky md:top-[calc(68px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 overflow-x-auto scrollbar-none px-5 py-3.5 md:px-8 lg:flex-wrap lg:gap-3 lg:overflow-visible">
          <span className="shrink-0 whitespace-nowrap text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mr-2">Region</span>
          {regions.map((r) => (
            <Chip key={r} className="shrink-0" active={region === r} aria-pressed={region === r} onClick={() => setRegion(r)}>
              {r}
            </Chip>
          ))}
          {practices.length > 1 ? (
            <>
              <span className="shrink-0 whitespace-nowrap text-[12px] uppercase tracking-wider text-ng-ink-muted font-semibold mr-2 ml-4">
                Practice
              </span>
              {practices.map((p) => (
                <Chip key={p} className="shrink-0" active={practice === p} aria-pressed={practice === p} onClick={() => setPractice(p)}>
                  {p}
                </Chip>
              ))}
            </>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-8 md:px-8">
        <p className="text-[13.5px] text-ng-ink-muted" aria-live="polite">
          {filtered
            ? `${shown.length} of ${farms.length} farm${farms.length === 1 ? "" : "s"}`
            : `${farms.length} farm${farms.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-5 md:px-8 md:pb-24">
        {shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ng-line-soft px-6 py-12 text-center">
            <p className="text-[15px] font-semibold text-ng-forest-deep">No farms match these filters yet.</p>
            <button
              type="button"
              onClick={() => {
                setRegion(ALL_REGIONS);
                setPractice(ALL_PRACTICES);
              }}
              className="mt-3 text-[14px] font-semibold text-ng-forest underline underline-offset-4 cursor-pointer"
            >
              Show all farms
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((f, i) => {
              const since = f.partneredSince ? new Date(f.partneredSince).getFullYear() : null;
              return (
                <Reveal key={f.id} className="h-full" delay={(i % 3) * 0.08}>
                  <Link
                    href={`/farms/${f.id}`}
                    className="group flex h-full flex-col rounded-3xl overflow-hidden bg-ng-paper border border-ng-line-soft hover:-translate-y-0.5 hover:shadow-[var(--shadow-ng-float)] transition-all duration-300"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={f.image ?? "/images/placeholder.svg"}
                        alt={f.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ng-forest-deep/70 via-transparent" />
                      {since ? (
                        <span className="absolute top-3 left-3 ng-chip bg-ng-cream/90 text-ng-forest-deep border-ng-cream">
                          Partner since {since}
                        </span>
                      ) : null}
                      <span className="absolute bottom-3 left-3 right-3 font-display text-[22px] text-ng-cream leading-tight">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-[13px] text-ng-ink-soft">
                        {f.region}
                        {f.hectares ? ` · ${f.hectares} ha` : ""}
                      </p>
                      <p className="text-[14px] text-ng-ink-muted mt-3 leading-relaxed line-clamp-3">{f.story}</p>
                      <div className="mt-auto pt-4 flex flex-wrap gap-2">
                        {f.practices.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-ng-cream border border-ng-forest-deep/30 text-ng-forest-deep capitalize"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
