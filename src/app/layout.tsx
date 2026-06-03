import type { Metadata } from "next";
import { Roboto_Slab, Lora, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { CommerceProvider } from "@/lib/commerce";
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

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
      className={`${robotoSlab.variable} ${lora.variable} ${figtree.variable} ${jetbrains.variable}`}
    >
      <body className="bg-ng-paper text-ng-ink antialiased min-h-screen">
        <AuthProvider>
          <CommerceProvider>
            <LocationProvider>
              <CartProvider>
                <WishlistProvider>
                  <AddressProvider>{children}</AddressProvider>
                </WishlistProvider>
              </CartProvider>
            </LocationProvider>
          </CommerceProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
