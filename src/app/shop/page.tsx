import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Icon } from "@/components/ui/icon";
import { PRODUCTS, CATEGORIES } from "@/components/ng/data";
import { ProductListing } from "@/components/ng/shop/product-listing";
import { ShopTrustStrip } from "@/components/ng/shop/trust-strip";

export const metadata: Metadata = {
  title: "Shop the pantry — Nutri Greenz",
  description:
    "Browse the whole pantry — cold-pressed oils, A2 ghee, raw honey, millets, spices and more. Single-origin, lab-tested, fairly sourced.",
};

export default function ShopPage() {
  const avgRating = (
    PRODUCTS.reduce((sum, p) => sum + p.rating, 0) / PRODUCTS.length
  ).toFixed(1);

  return (
    <PageShell>
      <PageHero
        eyebrow={`The full harvest · ${PRODUCTS.length} SKUs across ${CATEGORIES.length} categories`}
        title={
          <>
            Browse the <em className="italic text-ng-leaf">whole pantry.</em>
          </>
        }
        description="Every item single-origin, every lot lab-tested, every farmer paid fairly. Filter, search and sort your way to a better shelf."
      >
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-1.5 text-[13px] text-ng-ink-muted">
          <Link href="/" className="transition-colors hover:text-ng-forest">
            Home
          </Link>
          <Icon name="alt-arrow-right-linear" size={14} />
          <span className="font-medium text-ng-forest">Shop</span>
        </nav>

        {/* At-a-glance proof chips */}
        <dl className="mt-8 flex flex-wrap gap-2.5">
          {[
            { icon: "star-bold", label: `${avgRating} avg rating` },
            { icon: "test-tube-bold", label: "Lab-tested every lot" },
            { icon: "map-point-wave-bold", label: "Traceable to the farm" },
            { icon: "delivery-bold", label: "Free delivery over ₹599" },
          ].map((s) => (
            <div
              key={s.label}
              className="inline-flex items-center gap-2 rounded-full border border-ng-line-soft bg-ng-paper/70 px-3.5 py-1.5 text-[12px] font-medium text-ng-forest backdrop-blur-sm"
            >
              <Icon name={s.icon} size={14} className="text-ng-clay" />
              {s.label}
            </div>
          ))}
        </dl>
      </PageHero>

      <ShopTrustStrip />
      <ProductListing />
    </PageShell>
  );
}
