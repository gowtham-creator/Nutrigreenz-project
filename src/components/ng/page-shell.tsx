import type { ReactNode } from "react";
import { PromoBar } from "./promo-bar";
import { Header } from "./header";
import { Footer } from "./footer";
import { cn } from "@/lib/utils";

export function PageShell({ children, className, hideFooter, hidePromo }: { children: ReactNode; className?: string; hideFooter?: boolean; hidePromo?: boolean }) {
  return (
    <div className={cn("bg-ng-paper text-ng-ink min-h-screen flex flex-col", className)}>
      {!hidePromo ? <PromoBar /> : null}
      <Header />
      <main className="flex-1">{children}</main>
      {!hideFooter ? <Footer /> : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "cream",
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "cream" | "sage" | "forest";
  children?: ReactNode;
}) {
  const toneClass =
    tone === "forest"
      ? "bg-ng-forest-deep text-ng-cream"
      : tone === "sage"
        ? "bg-ng-sage/30"
        : "bg-ng-cream-mesh bg-ng-cream";
  const titleColor = tone === "forest" ? "text-ng-cream" : "text-ng-forest-deep";
  const eyebrowColor = tone === "forest" ? "text-ng-clay" : "text-ng-forest";
  const descColor = tone === "forest" ? "text-ng-cream/70" : "text-ng-ink-muted";
  return (
    <section className={cn("relative overflow-hidden", toneClass)}>
      <div className={cn("mx-auto max-w-7xl px-5 md:px-8 py-16 md:py-24", align === "center" && "text-center")}>
        {eyebrow ? <span className={cn("ng-eyebrow", eyebrowColor)}>{eyebrow}</span> : null}
        <h1 className={cn("font-display text-[clamp(40px,6vw,72px)] leading-[1.02] tracking-tight mt-3 max-w-3xl", titleColor, align === "center" && "mx-auto")}>
          {title}
        </h1>
        {description ? (
          <p className={cn("text-[17px] leading-relaxed mt-5 max-w-2xl", descColor, align === "center" && "mx-auto")}>{description}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
