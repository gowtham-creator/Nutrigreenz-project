import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ng/page-shell";
import { pageMeta } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getStorefrontProductBySlug } from "@/lib/storefront-catalog";
import { SUBSCRIBER_DISCOUNT_BPS } from "@/lib/subscriptions-core";
import { SubscribeForm, type SubscribeVariant } from "@/components/ng/subscriptions/subscribe-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Subscribe & save · Nutri Greenz",
    description: "Set up a recurring Nutri Greenz delivery and save on every order.",
    path: "/subscribe",
  }),
  robots: { index: false, follow: true },
};

/**
 * /subscribe?product=<slug>&variant=<id>&qty=<n>
 *
 * The product and its variants come from the catalogue here, never from the
 * query string; the query only says which one was selected on the PDP.
 */
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isFeatureEnabled("subscriptions"))) notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const slug = one(sp.product);
  if (!slug) notFound();
  const product = await getStorefrontProductBySlug(slug);
  const variants: SubscribeVariant[] = (product?.variants ?? []).map((v) => ({
    id: v.id,
    label: v.pack ? `${v.label} · ${v.pack}` : v.label,
    price: v.price,
    inStock: v.inStock,
    image: v.imageUrl ?? product?.image ?? null,
  }));
  if (!product || variants.length === 0) notFound();

  const wanted = one(sp.variant);
  const initialVariantId = variants.some((v) => v.id === wanted)
    ? wanted
    : (variants.find((v) => v.inStock) ?? variants[0]).id;
  const qty = Math.min(20, Math.max(1, Number.parseInt(one(sp.qty), 10) || 1));

  return (
    <PageShell hidePromo>
      <SubscribeForm
        product={{ slug: product.slug, title: product.title, image: product.image }}
        variants={variants}
        initialVariantId={initialVariantId}
        initialQty={qty}
        discountBps={SUBSCRIBER_DISCOUNT_BPS}
      />
    </PageShell>
  );
}
