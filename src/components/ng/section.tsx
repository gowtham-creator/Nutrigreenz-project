import { type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion";

interface SectionProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  eyebrow?: string;
  heading?: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  id?: string;
  /** Inline surface style — used to tint a band per the category theme. */
  style?: CSSProperties;
}

export function Section({
  children,
  className,
  containerClassName,
  eyebrow,
  heading,
  description,
  align = "left",
  id,
  style,
}: SectionProps) {
  return (
    <section id={id} className={cn("relative py-16 md:py-28", className)} style={style}>
      <div
        className={cn(
          "mx-auto max-w-7xl px-5 md:px-8",
          containerClassName,
        )}
      >
        {(eyebrow || heading || description) ? (
          <Reveal
            as="header"
            className={cn(
              "mb-10 md:mb-16 flex flex-col gap-4",
              align === "center" && "items-center text-center",
              align === "left" && "max-w-2xl",
            )}
          >
            {eyebrow ? <span className="ng-eyebrow">{eyebrow}</span> : null}
            {heading ? (
              <h2 className="font-display text-[clamp(28px,4.6vw,52px)] leading-[1.05] text-ng-forest-deep tracking-tight">
                {heading}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[17px] text-ng-ink-muted leading-relaxed text-pretty">
                {description}
              </p>
            ) : null}
          </Reveal>
        ) : null}
        {children}
      </div>
    </section>
  );
}
