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
      {/* Forest tone gets a green-forward gradient + texture so the dark hero
          reads with depth and on-brand green contrast (instead of flat green). */}
      {tone === "forest" ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* Layered leaf / bright-green glows for contrast + depth */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 55% at 88% 10%, rgba(102,191,115,0.22), transparent 60%), radial-gradient(ellipse 55% 60% at 6% 100%, rgba(76,175,80,0.16), transparent 62%), radial-gradient(ellipse 95% 65% at 50% 134%, rgba(31,77,46,0.6), transparent 70%)",
            }}
          />
          {/* Faint sage dot grid — subtle organic texture */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(rgba(178,199,178,0.75) 1px, transparent 1.4px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Soft leaf corner glow to fill the open right side */}
          <div className="absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-ng-leaf/[0.12] blur-[90px]" />
          {/* Crisp green hairline at the base */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ng-leaf/35 to-transparent" />
        </div>
      ) : null}
      <div className={cn("relative z-10 mx-auto max-w-7xl px-5 md:px-8 py-16 md:py-24", align === "center" && "text-center")}>
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
