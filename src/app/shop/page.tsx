import { Suspense } from "react";
import { freeDeliveryThresholdLabel } from "@/lib/free-delivery";
import Link from "next/link";
import type { Metadata } from "next";
import { PageShell, PageHero } from "@/components/ng/page-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon, type UiIconName } from "@/components/ui/ui-icon";
import { ProductListing } from "@/components/ng/shop/product-listing";
import { ShopTrustStrip } from "@/components/ng/shop/trust-strip";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";

export const metadata: Metadata = {
  title: "Shop the pantry · Nutri Greenz",
  description:
    "Browse the whole pantry. Cold-pressed oils, A2 ghee, raw honey, millets, spices and more. Single-origin, lab-tested, fairly sourced.",
};

// Re-fetch the catalog at most once a minute so Inventory-Portal edits (price,
// stock, new SKUs, status) appear on the live shop without a redeploy.
export const revalidate = 60;

export default async function ShopPage() {
  const { products, categories, categoryTags } = await getStorefrontCatalog();
  const freeFrom = await freeDeliveryThresholdLabel();
  const avgRating =
    products.length > 0
      ? (products.reduce((sum, p) => sum + p.rating, 0) / products.length).toFixed(1)
      : "5.0";

  return (
    <PageShell>
      <PageHero
        image="/images/shop/shop-hero.webp"
        eyebrow={`The full harvest · ${products.length} SKUs across ${categories.length} categories`}
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
          {/* Same marks as the trust band below, for the same reason: a licence
              looks like a certificate and a lot code is scanned off a QR
              square. The Lucide footprints that stood for "traceable" asked the
              reader to decode "trail" first. */}
          {([
            { icon: "star" as const, label: `${avgRating} avg rating` },
            { icon: "flask" as const, label: "Lab-tested every lot" },
            { icon: "qr" as const, label: "Traceable to the farm" },
            { icon: "delivery" as const, label: `Free delivery over ${freeFrom}` },
          ] as { label: string; icon: UiIconName }[]).map((s) => (
            <div
              key={s.label}
              className="inline-flex items-center gap-2 rounded-full border border-ng-line-soft bg-ng-paper/70 px-3.5 py-1.5 text-[12px] font-medium text-ng-forest backdrop-blur-sm"
            >
              <UiIcon name={s.icon} size={15} className="text-ng-clay-deep" />
              {s.label}
            </div>
          ))}
        </dl>
      </PageHero>

      <ShopTrustStrip />
      {/* Suspense because ProductListing reads ?q= via useSearchParams, which
          opts a client component out of prerendering unless a boundary exists.
          Without it the whole page falls back to client-side rendering and the
          catalogue stops being static. */}
      <Suspense fallback={null}>
        <ProductListing products={products} categoryTags={categoryTags} />
      </Suspense>
    </PageShell>
  );
}
