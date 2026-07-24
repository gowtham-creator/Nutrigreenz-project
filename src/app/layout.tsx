import type { Metadata } from "next";
import { Roboto_Slab, Lora, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { LinkPhonePrompt } from "@/components/ng/account/link-phone-prompt";
import { CommerceProvider } from "@/lib/commerce";
import { LoyaltyConfigProvider } from "@/lib/loyalty-config";
import { LocationProvider } from "@/lib/location";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { AddressProvider } from "@/lib/addresses";

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
  title: "Nutrigreenz — Farm-to-table, fully traceable",
  description:
    "Born in soil. Built for tomorrow. Traceable produce, cold-pressed oils, A2 ghee and superfoods — straight from partner farms to your kitchen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${robotoSlab.variable} ${lora.variable} ${hanken.variable} ${jetbrains.variable}`}
    >
      <body className="bg-ng-paper text-ng-ink antialiased min-h-screen">
        <AuthProvider>
          <CommerceProvider>
            <LoyaltyConfigProvider>
              <LocationProvider>
                <CartProvider>
                  <WishlistProvider>
                    <AddressProvider>
                      {children}
                      <LinkPhonePrompt />
                    </AddressProvider>
                  </WishlistProvider>
                </CartProvider>
              </LocationProvider>
            </LoyaltyConfigProvider>
          </CommerceProvider>
        </AuthProvider>
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={3500}
          offset={{ top: "84px" }}
          mobileOffset={{ top: "84px" }}
        />
      </body>
    </html>
  );
}
