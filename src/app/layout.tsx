import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { VisitBeacon } from "@/components/ng/visit-beacon";
import { NgToaster } from "@/components/ng/toast";
import { AuthProvider } from "@/lib/auth";
import { LinkPhonePrompt } from "@/components/ng/account/link-phone-prompt";
import { NavigationProgress } from "@/components/ng/navigation-progress";
import { CommerceProvider } from "@/lib/commerce";
import { LoyaltyConfigProvider } from "@/lib/loyalty-config";
import { ComingSoon } from "@/components/ng/coming-soon";
import { BottomTabs } from "@/components/ng/bottom-tabs";
import { LocationProvider } from "@/lib/location";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { AddressProvider } from "@/lib/addresses";
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/ng/json-ld";

/*
 * Display + serif — Fraunces.
 *
 * Replaces Roboto Slab, which was the brand voice on every heading of the site
 * and was the wrong face for it twice over. Roboto Slab is a slab serif built
 * for screen UI legibility at small sizes: even stroke weight, blunt
 * rectangular serifs, no modulation. Set at 40–58px on a hero it has nothing to
 * say — it reads as a system font enlarged, which is what "template" looks
 * like. It is also the one family a premium type brief rules out on sight.
 *
 * Fraunces is a variable old-style serif with real stroke contrast and an
 * optical-size axis, so a 12px eyebrow and a 58px hero are drawn as genuinely
 * different cuts rather than one outline scaled. That is the whole difference
 * between type that was chosen and type that was picked. It is also the
 * register premium food brands actually use — warm, slightly bookish,
 * hand-made rather than corporate, which is the claim this catalogue makes.
 *
 * `--font-lora` resolves here too, so the wordmark and pull-quotes follow the
 * same voice and one webfont family leaves the bundle entirely: four families
 * become three.
 */
/*
 * The three faces are served from this repo, not fetched from Google at build
 * time. The Google download failed intermittently on Vercel ("Cannot read
 * properties of null" in next/font) whenever several builds ran close together,
 * and each failure took the whole deploy down with it. The files are the same
 * open-licensed variable fonts (Fontsource 5.3.0, latin subset, all axes), so
 * nothing on screen changes. Licences sit next to them in ./fonts.
 */
const fraunces = localFont({
  variable: "--font-fraunces",
  display: "swap",
  src: [
    { path: "./fonts/fraunces-latin-full-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/fraunces-latin-full-italic.woff2", weight: "100 900", style: "italic" },
  ],
});


// Body sans — Hanken Grotesk: a sturdier, warmer humanist grotesque that reads
// more solid than the previous geometric sans and pairs with the slab-serif
// display face.
const hanken = localFont({
  variable: "--font-hanken",
  display: "swap",
  src: [{ path: "./fonts/hanken-grotesk-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
});

const jetbrains = localFont({
  variable: "--font-jetbrains",
  display: "swap",
  src: [{ path: "./fonts/jetbrains-mono-latin-wght-normal.woff2", weight: "100 800", style: "normal" }],
});

/**
 * Edge to edge on every phone and tablet. `viewport-fit=cover` lets the page
 * reach behind the notch, Dynamic Island, punch-hole camera and home bar, and
 * the brand green fills that space (see `.ng-safe-top` and globals.css), so
 * the top of the screen is never a stray white strip. `themeColor` tints the
 * Android status and address bars and older iOS Safari to match.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A1F12",
};

/**
 * Marks the admin and captain apps before first paint, so store-only pieces
 * (the coming-soon strip, the bottom tab bar) never flash there. The admin app
 * is served on admin.nutrigreenz.farm with clean paths like /orders, so the
 * host must be checked as well as the path.
 */
const OPERATOR_INIT = `(function(){try{if(/^(admin|captain)[.]/.test(location.hostname)||/^[/](admin|captain)([/]|$)/.test(location.pathname))document.documentElement.dataset.operator="1"}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Nutri Greenz · Cold-pressed oils, A2 ghee and raw honey",
  description:
    "Cold-pressed oils, A2 bilona ghee, raw honey and millets from partner farms, lab-tested and traceable to the farm, delivered across Hyderabad.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "en_IN", type: "website", images: [DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}
    >
      <body className="bg-ng-paper text-ng-ink antialiased min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: OPERATOR_INIT }} />
        {/* Paints the status-bar area (notch, Dynamic Island, punch-hole) in the
            brand green on phones that report a top safe area. Zero height
            everywhere else. */}
        <div aria-hidden className="ng-safe-top" />
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
        <AuthProvider>
          <CommerceProvider>
            <LoyaltyConfigProvider>
              <LocationProvider>
                <CartProvider>
                  <WishlistProvider>
                    <AddressProvider>
                      <ComingSoon />
                      {children}
                      <BottomTabs />
                      <LinkPhonePrompt />
                      {/* Outside the page tree on purpose: it must survive the
                          navigation it is reporting on, so it cannot live in
                          anything that unmounts when the route changes. */}
                      <NavigationProgress />
                    </AddressProvider>
                  </WishlistProvider>
                </CartProvider>
              </LocationProvider>
            </LoyaltyConfigProvider>
          </CommerceProvider>
        </AuthProvider>
        {/* Counts one visit per browser session against its city. Aggregate
            only — see the route and the privacy policy's "Where visitors come
            from" section. */}
        <VisitBeacon />
        {/* Every notification in the product renders through this; see
            components/ng/toast.tsx. */}
        <NgToaster />
      </body>
    </html>
  );
}
