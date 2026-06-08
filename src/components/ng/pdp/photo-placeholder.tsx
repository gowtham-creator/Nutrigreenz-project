import { PRODUCE_ICONS, type ProduceIconName } from "@/components/ng/produce-icons";
import { cn } from "@/lib/utils";

interface PhotoPlaceholderProps {
  /** Category produce glyph, so the placeholder reads as product-relevant. */
  icon: ProduceIconName;
  /** Caption chip describing what photo belongs here (e.g. "Front of pack"). */
  label?: string;
  /** Visual size: main gallery stage, small thumbnail, or wide lifestyle band. */
  variant?: "main" | "thumb" | "wide";
  className?: string;
}

/**
 * PhotoPlaceholder — an attractive, on-brand stand-in for product photography
 * that doesn't exist yet. Instead of a flat grey box (or one generic logo on
 * every slot), each frame shows the category's produce glyph on a soft cream
 * gradient with a faint dotted texture and a caption chip telling the client
 * exactly which shot belongs there. Drop a real <Image> in later — the framing
 * (rounded corners, ring, halo) already lives in the parent.
 */
export function PhotoPlaceholder({ icon, label, variant = "main", className }: PhotoPlaceholderProps) {
  const Glyph = PRODUCE_ICONS[icon] ?? PRODUCE_ICONS.leaf;
  const isThumb = variant === "thumb";
  const isWide = variant === "wide";

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Soft brand gradient base */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-ng-cream via-ng-cream to-ng-cream-deep" />
      {/* Faint dotted texture so the frame reads as a styled stage, not empty */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(31,77,46,0.07) 1px, transparent 1.5px)",
          backgroundSize: isThumb ? "9px 9px" : "18px 18px",
        }}
      />
      {/* Warm halo behind the glyph */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ng-leaf/12 blur-3xl"
        style={{ width: "60%", height: "60%" }}
      />

      <div className={cn("relative flex h-full w-full items-center justify-center", isWide ? "gap-4" : "flex-col gap-3")}>
        <span
          className={cn(
            "grid place-items-center bg-ng-paper text-ng-leaf shadow-[var(--shadow-ng-card)] ring-1 ring-ng-line-soft",
            isThumb ? "h-9 w-9 rounded-xl" : "h-24 w-24 rounded-3xl sm:h-28 sm:w-28",
          )}
        >
          <Glyph size={isThumb ? 20 : 56} />
        </span>

        {!isThumb && label ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-paper/85 px-3 py-1.5 text-[11px] font-medium text-ng-ink-muted shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-ng-clay" />
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** True when a src is the brand placeholder (or empty) rather than a real photo. */
export function isPlaceholderSrc(src?: string): boolean {
  return !src || src.endsWith("placeholder.svg");
}
