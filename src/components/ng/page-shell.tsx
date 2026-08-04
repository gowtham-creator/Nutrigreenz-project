import type { ReactNode } from "react";
import Image from "next/image";
import { PromoBar } from "./promo-bar";
import { Header } from "./header";
import { Footer } from "./footer";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ng/page-transition";

export function PageShell({ children, className, hideFooter, hidePromo }: { children: ReactNode; className?: string; hideFooter?: boolean; hidePromo?: boolean }) {
  return (
    <div className={cn("bg-ng-paper text-ng-ink min-h-screen flex flex-col", className)}>
      {!hidePromo ? <PromoBar /> : null}
      <Header />
      {/* Only <main> fades. The promo bar, header and footer are chrome that
          persists across navigation — fading them too would make the whole
          page blink on every click, which reads as a reload rather than a
          transition. */}
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      {!hideFooter ? <Footer /> : null}
    </div>
  );
}

/**
 * Per-page hero washes — a distinct-but-on-theme soft gradient behind each
 * light hero so pages don't share one flat cream field. Every wash is built
 * from the brand tokens and stays subtle (single-digit alphas) so headings and
 * body copy keep their contrast. Dark (forest) heroes keep their own treatment.
 */
type HeroTint = "field" | "editorial" | "story";
const HERO_TINTS: Record<HeroTint, string> = {
  // Farms — a fresh sage/leaf field rising from the top corners.
  field:
    "radial-gradient(ellipse 78% 66% at 6% -14%, rgba(102,191,115,0.16), transparent 60%), radial-gradient(ellipse 66% 60% at 100% 2%, rgba(178,199,178,0.34), transparent 64%), linear-gradient(180deg, #FBFAF4 0%, #F2F5EA 60%, var(--ng-cream) 100%)",
  // Journal — a warm editorial paper wash with the faintest gold warmth.
  editorial:
    "radial-gradient(ellipse 70% 60% at 94% -12%, rgba(181,134,47,0.08), transparent 58%), radial-gradient(ellipse 60% 56% at 2% 8%, rgba(178,199,178,0.26), transparent 62%), linear-gradient(180deg, #FCFBF5 0%, #F5F2E6 62%, var(--ng-cream) 100%)",
  // About — a calm forest/leaf brand wash for the origin story.
  story:
    "radial-gradient(ellipse 70% 62% at 4% -12%, rgba(31,77,46,0.10), transparent 58%), radial-gradient(ellipse 60% 56% at 98% 4%, rgba(102,191,115,0.14), transparent 62%), linear-gradient(180deg, #FBFAF4 0%, #F1F4EC 60%, var(--ng-cream) 100%)",
};

export function PageHero({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "cream",
  tint,
  wash,
  image,
  serifTitle,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "cream" | "sage" | "forest";
  tint?: HeroTint;
  /** Arbitrary per-category hero wash (CSS `background`); wins over `tint`. */
  wash?: string;
  /** Optional background photo — sits behind a left→right cream scrim so the
   *  left-aligned dark text stays fully legible over the image. Wins over wash. */
  image?: string;
  /** Render the title in the soft serif (Lora) instead of the slab display. */
  serifTitle?: boolean;
  children?: ReactNode;
}) {
  const toneClass =
    tone === "forest"
      ? "bg-ng-forest-deep text-ng-cream"
      : tone === "sage"
        ? "bg-ng-sage/30"
        : "bg-ng-cream";
  const titleColor = tone === "forest" ? "text-ng-cream" : "text-ng-forest-deep";
  const eyebrowColor = tone === "forest" ? "text-ng-clay" : "text-ng-forest";
  const descColor = tone === "forest" ? "text-ng-cream/70" : "text-ng-ink-muted";
  return (
    <section
      className={cn(
        "relative overflow-hidden",
        toneClass,
        image && "min-h-[300px] md:min-h-[400px]",
      )}
    >
      {/* A background photo (farms / journal heroes) behind a cream scrim. */}
      {image ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* Left→right cream scrim so the left-aligned dark text stays legible. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                tone === "forest"
                  ? "linear-gradient(100deg, rgba(11,33,20,0.95) 0%, rgba(11,33,20,0.86) 34%, rgba(11,33,20,0.55) 58%, rgba(11,33,20,0.34) 82%, rgba(11,33,20,0.26) 100%)"
                  : "linear-gradient(100deg, rgba(244,241,232,0.97) 0%, rgba(244,241,232,0.9) 30%, rgba(244,241,232,0.58) 52%, rgba(244,241,232,0.16) 78%, rgba(244,241,232,0) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ng-forest/15 to-transparent" />
        </div>
      ) : /* Forest tone gets a green-forward gradient + texture so the dark hero
          reads with depth and on-brand green contrast (instead of flat green). */
      tone === "forest" ? (
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
      ) : (wash || tint) ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* Distinct-but-on-theme tinted wash for this page's light hero. A
              per-category `wash` (e.g. an Oils vs Honey hero) wins over `tint`. */}
          <div className="absolute inset-0" style={{ background: wash ?? (tint ? HERO_TINTS[tint] : undefined) }} />
          {/* Whisper-fine dot texture for an intentional, crafted surface. */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(31,77,46,0.7) 1px, transparent 1.4px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Soft base hairline to seat the hero on the page below it. */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-ng-forest/15 to-transparent" />
        </div>
      ) : null}
      <div className={cn("relative z-10 mx-auto max-w-7xl px-5 md:px-8 py-16 md:py-24", align === "center" && "text-center")}>
        {eyebrow ? <span className={cn("ng-eyebrow", eyebrowColor)}>{eyebrow}</span> : null}
        <h1 className={cn(serifTitle ? "font-serif" : "font-display", "text-[clamp(30px,6vw,72px)] leading-[1.02] tracking-tight mt-3 max-w-3xl text-balance break-words", titleColor, align === "center" && "mx-auto")}>
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
