import { PromoBar } from "@/components/ng/promo-bar";
import { Header } from "@/components/ng/header";
import { Footer } from "@/components/ng/footer";
import { Hero } from "@/components/ng/sections/hero";
import { Categories } from "@/components/ng/sections/categories";
import { Why } from "@/components/ng/sections/why";
import { Traceability } from "@/components/ng/sections/traceability";
import { ProductRail } from "@/components/ng/sections/product-rail";
import { Farms } from "@/components/ng/sections/farms";
import { Testimonials } from "@/components/ng/sections/testimonials";
import { Journal } from "@/components/ng/sections/journal";
import { CommunityCTA } from "@/components/ng/sections/community-cta";
import { PRODUCTS } from "@/components/ng/data";

export default function Home() {
  const oils = PRODUCTS.filter((p) => p.tags?.includes("oil"));
  const pantry = PRODUCTS.filter((p) => p.tags?.some((t) => ["ghee", "honey", "millet", "flour"].includes(t)));

  return (
    <main className="bg-ng-paper text-ng-ink">
      <PromoBar />
      <Header />
      <Hero />
      <Categories />
      <Why />
      <Traceability />
      <ProductRail
        eyebrow="Pressed this week"
        heading={<>Cold-pressed oils, <em className="italic text-ng-leaf">fresh from the mill.</em></>}
        description="Every bottle is pressed within seven days of dispatch. Always glass. Never plastic."
        products={oils}
        ctaHref="/shop/oils"
        ctaLabel="Shop all oils"
      />
      <Farms />
      <ProductRail
        eyebrow="Heritage pantry"
        heading={<>Ghee, honey, and grains <em className="italic text-ng-leaf">the slow way.</em></>}
        products={pantry}
        ctaHref="/shop"
      />
      <Testimonials />
      <Journal />
      <CommunityCTA />
      <Footer />
    </main>
  );
}
