import { Stars } from "@/components/ng/stars";
import { Icon } from "@/components/ui/icon";

export interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified?: boolean;
}

interface ReviewsProps {
  rating: number;
  reviewCount: number;
  reviews: Review[];
}

/**
 * Reviews — rating summary header plus a set of sample customer reviews.
 */
export function Reviews({ rating, reviewCount, reviews }: ReviewsProps) {
  return (
    <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
      {/* Summary */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-3xl border border-ng-line-soft bg-ng-cream p-6 text-center">
          <p className="font-display text-5xl text-ng-forest-deep">{rating.toFixed(1)}</p>
          <Stars rating={rating} size="md" showCount={false} className="mt-2 justify-center" />
          <p className="mt-2 text-[13px] text-ng-ink-muted">{reviewCount.toLocaleString()} verified reviews</p>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-ng-forest">
            <Icon name="verified-check-bold" size={15} className="text-ng-leaf" />
            98% recommend this product
          </div>
        </div>
      </div>

      {/* List */}
      <ul className="flex flex-col divide-y divide-ng-line-soft">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-6 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars rating={r.rating} size="sm" showCount={false} />
              <span className="text-[12px] text-ng-ink-muted">{r.date}</span>
            </div>
            <p className="font-display text-lg text-ng-forest-deep">{r.title}</p>
            <p className="text-[14px] leading-relaxed text-ng-ink">{r.body}</p>
            <p className="mt-1 flex items-center gap-2 text-[13px] text-ng-ink-muted">
              <span className="font-medium text-ng-forest">{r.name}</span>
              <span aria-hidden>·</span>
              <span>{r.location}</span>
              {r.verified ? (
                <span className="inline-flex items-center gap-1 text-ng-leaf">
                  <Icon name="verified-check-bold" size={14} />
                  Verified buyer
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
