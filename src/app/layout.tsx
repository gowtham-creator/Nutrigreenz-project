import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { VisitBeacon } from "@/components/ng/visit-beacon";
import { AuthProvider } from "@/lib/auth";
import { LinkPhonePrompt } from "@/components/ng/account/link-phone-prompt";
import { NavigationProgress } from "@/components/ng/navigation-progress";
import { CommerceProvider } from "@/lib/commerce";
import { LoyaltyConfigProvider } from "@/lib/loyalty-config";
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
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  display: "swap",
});


// Body sans — Hanken Grotesk: a sturdier, warmer humanist grotesque that reads
// more solid than the previous geometric sans and pairs with the slab-serif
// display face.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

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
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}
    >
      <body className="bg-ng-paper text-ng-ink antialiased min-h-screen">
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
        <AuthProvider>
          <CommerceProvider>
            <LoyaltyConfigProvider>
              <LocationProvider>
                <CartProvider>
                  <WishlistProvider>
                    <AddressProvider>
                      {children}
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
        {/* richColors and closeButton are off: notifications render through
            <ngToast>, which draws its own branded surface, glyph and dismiss
            control. Leaving sonner's chrome on would paint a second frame
            around ours. */}
        {/* Counts one visit per browser session against its city. Aggregate
            only — see the route and the privacy policy's "Where visitors come
            from" section. */}
        <VisitBeacon />
        {/*
          `closeButton` is the whole reason this comment exists.

          43 files call `toast()` straight from sonner and exactly one uses the
          branded wrapper, so nearly every notification in the product — cart
          confirmations, admin saves, captain sales, checkout errors — rendered
          with no way to dismiss it. A shopper who triggered one waited it out.
          Setting it here fixes all 43 at once, which is the only reason not to
          migrate the call sites instead.

          Sonner places the button at the top-left of the toast; the styling
          below just brings it onto the brand's cream/ink rather than its
          default white-on-grey.
        */}
        <Toaster
          position="top-center"
          duration={4200}
          closeButton
          offset={{ top: "84px" }}
          mobileOffset={{ top: "84px" }}
          toastOptions={{
            classNames: {
              closeButton:
                "!bg-ng-cream !border-ng-line !text-ng-forest-deep hover:!bg-ng-sage/60",
            },
          }}
        />
      </body>
    </html>
  );
}
