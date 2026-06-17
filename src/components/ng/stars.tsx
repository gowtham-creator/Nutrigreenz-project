import { cn } from "@/lib/utils";

interface StarsProps {
  rating: number; // 0..5
  reviewCount?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
  showCount?: boolean;
}

const SIZE_MAP = { xs: 12, sm: 14, md: 16 };

export function Stars({ rating, reviewCount, size = "sm", className, showCount = true }: StarsProps) {
  const px = SIZE_MAP[size];
  const full = Math.floor(rating);
  const half = rating - full >= 0.4 && rating - full < 0.9;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex" aria-label={`${rating} out of 5`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i < full;
          const isHalf = i === full && half;
          return (
            <svg
              key={i}
              width={px}
              height={px}
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="text-ng-clay"
            >
              <defs>
                <linearGradient id={`star-half-${i}-${px}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="rgba(151,144,127,0.32)" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l2.95 6.6 7.05.62-5.35 4.72 1.65 7.06L12 17.27 5.7 21l1.65-7.06L2 9.22l7.05-.62L12 2z"
                fill={filled ? "currentColor" : isHalf ? `url(#star-half-${i}-${px})` : "rgba(151,144,127,0.32)"}
              />
            </svg>
          );
        })}
      </span>
      {showCount && reviewCount !== undefined ? (
        <span className="text-[12px] text-ng-ink-soft">
          {rating.toFixed(1)} ({reviewCount.toLocaleString("en-IN")})
        </span>
      ) : null}
    </span>
  );
}
