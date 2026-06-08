"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Stars } from "@/components/ng/stars";
import { Button } from "@/components/ng/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { Review } from "./reviews";

interface ReviewsSummaryProps {
  rating: number;
  reviewCount: number;
  reviews: Review[];
}

type SortKey = "recent" | "helpful" | "top";

/**
 * ReviewsSummary — rating summary (avg + 5-bar distribution + total),
 * a "Write a review" button (toast only), and a sorted list of reviews with
 * Verified badge + helpful up/down counts + a "Load more" affordance.
 */
export function ReviewsSummary({ rating, reviewCount, reviews }: ReviewsSummaryProps) {
  const [sort, setSort] = useState<SortKey>("helpful");
  const [shown, setShown] = useState(3);
  const [votes, setVotes] = useState<Record<string, "up" | "down" | undefined>>({});

  // Deterministic star distribution derived from the aggregate rating + count.
  const distribution = useMemo(() => {
    const weights = rating >= 4.7 ? [0.78, 0.15, 0.04, 0.02, 0.01] : rating >= 4.4 ? [0.62, 0.24, 0.08, 0.04, 0.02] : [0.48, 0.3, 0.12, 0.06, 0.04];
    return [5, 4, 3, 2, 1].map((star, i) => ({
      star,
      count: Math.round(reviewCount * weights[i]),
      pct: Math.round(weights[i] * 100),
    }));
  }, [rating, reviewCount]);

  const sorted = useMemo(() => {
    const base = reviews.map((r, i) => ({ ...r, _helpful: 18 + ((i * 7 + r.title.length) % 40), _seq: i }));
    if (sort === "recent") return [...base].sort((a, b) => b._seq - a._seq === 0 ? 0 : a._seq - b._seq);
    if (sort === "top") return [...base].sort((a, b) => b.rating - a.rating);
    return [...base].sort((a, b) => b._helpful - a._helpful);
  }, [reviews, sort]);

  const vote = (id: string, dir: "up" | "down") => {
    setVotes((v) => ({ ...v, [id]: v[id] === dir ? undefined : dir }));
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
      {/* Summary + distribution */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="flex flex-col gap-5 rounded-3xl border border-ng-line-soft bg-ng-cream p-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="font-display text-5xl leading-none text-ng-forest-deep">{rating.toFixed(1)}</p>
              <Stars rating={rating} size="sm" showCount={false} className="mt-2 justify-center" />
            </div>
            <p className="text-[13px] leading-snug text-ng-ink-muted">
              Based on <span className="font-semibold text-ng-forest-deep">{reviewCount.toLocaleString()}</span> verified reviews
            </p>
          </div>

          <ul className="flex flex-col gap-1.5">
            {distribution.map((d) => (
              <li key={d.star} className="flex items-center gap-2 text-[12px] text-ng-ink-muted">
                <span className="w-8 shrink-0 tabular-nums">{d.star}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ng-line-soft">
                  <span className="block h-full rounded-full bg-ng-clay" style={{ width: `${d.pct}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums">{d.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>

          <Button
            variant="secondary"
            size="md"
            fullWidth
            className="cursor-pointer"
            onClick={() => toast.success("Review form coming soon", { description: "Verified buyers can review from their orders." })}
          >
            <Icon name="pen-new-square-bold" size={16} />
            Write a review
          </Button>
        </div>
      </div>

      {/* List + sort */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ng-ink-muted">Sort by</span>
          {(
            [
              { key: "helpful", label: "Most helpful" },
              { key: "top", label: "Highest rated" },
              { key: "recent", label: "Most recent" },
            ] as { key: SortKey; label: string }[]
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                sort === s.key ? "border-ng-forest bg-ng-forest text-ng-cream" : "border-ng-line text-ng-forest hover:border-ng-leaf",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <ul className="flex flex-col divide-y divide-ng-line-soft">
          {sorted.slice(0, shown).map((r) => {
            const v = votes[r.id];
            return (
              <li key={r.id} className="flex flex-col gap-2 py-6 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars rating={r.rating} size="sm" showCount={false} />
                  <span className="text-[12px] text-ng-ink-muted">{r.date}</span>
                </div>
                <p className="font-display text-lg text-ng-forest-deep">{r.title}</p>
                <p className="text-[14px] leading-relaxed text-ng-ink">{r.body}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ng-ink-muted">
                  <span className="font-medium text-ng-forest">{r.name}</span>
                  <span aria-hidden>·</span>
                  <span>{r.location}</span>
                  {r.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ng-leaf/12 px-2 py-0.5 text-[12px] font-medium text-ng-forest">
                      <Icon name="verified-check-bold" size={14} className="text-ng-leaf" />
                      Verified
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-2">
                    <span className="text-[12px]">Helpful?</span>
                    <button
                      type="button"
                      onClick={() => vote(r.id, "up")}
                      aria-pressed={v === "up"}
                      aria-label="Mark helpful"
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[12px] tabular-nums transition-colors",
                        v === "up" ? "border-ng-leaf bg-ng-leaf/15 text-ng-forest" : "border-ng-line hover:border-ng-leaf",
                      )}
                    >
                      <Icon name="like-bold" size={13} />
                      {r._helpful + (v === "up" ? 1 : 0)}
                    </button>
                    <button
                      type="button"
                      onClick={() => vote(r.id, "down")}
                      aria-pressed={v === "down"}
                      aria-label="Mark not helpful"
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[12px] transition-colors",
                        v === "down" ? "border-ng-terracotta bg-ng-terracotta/10 text-ng-terracotta" : "border-ng-line hover:border-ng-terracotta",
                      )}
                    >
                      <Icon name="dislike-bold" size={13} />
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {shown < sorted.length ? (
          <Button
            variant="secondary"
            size="md"
            className="cursor-pointer self-start"
            onClick={() => setShown((s) => s + 3)}
          >
            <Icon name="refresh-bold" size={16} />
            Load more reviews
          </Button>
        ) : null}
      </div>
    </div>
  );
}
