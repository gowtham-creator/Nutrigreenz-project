import type { MetadataRoute } from "next";
import { FARMS, JOURNAL } from "@/components/ng/data";
import { getStorefrontCatalog } from "@/lib/storefront-catalog";

/** Public base URL for absolute sitemap entries. */
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutrigreenz.farm").replace(/\/$/, "");

/**
 * Categories and products come from the live catalogue, not from the sample
 * constants.
 *
 * Read from `@/components/ng/data`, this file was submitting a catalogue that
 * does not exist: /shop/spices, /shop/millets, /shop/gifting and around thirty
 * product URLs for things we have never sold. Every one of them resolves to an
 * empty page, which is a soft-404 to a crawler and a thin-content signal
 * against the whole domain — and the more of them there are, the less crawl
 * budget is left for the pages that do sell something.
 *
 * The trade-off is that this now depends on the database. If that call fails,
 * `getStorefrontCatalog` falls back to the samples, and the sample catalogue
 * would be submitted instead — so the failure is caught here and the sitemap
 * ships with its static routes alone. A short sitemap is recoverable on the
 * next crawl; a sitemap full of URLs that 404 has to be lived down.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const url = (path: string) => `${BASE_URL}${path}`;

  // Top-level marketing & commerce routes.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: url("/shop"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: url("/farms"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: url("/traceability"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: url("/lab"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: url("/journal"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: url("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: url("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: url("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: url("/wholesale"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: url("/careers"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: url("/press"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/loyalty"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/referral"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/sitemap"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    // Legal / policy
    { url: url("/policies/shipping"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: url("/policies/refund"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: url("/policies/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: url("/policies/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: url("/policies/cookies"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: url("/policies/attributions"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];

  /* `live` is false when the catalogue call fell through to the samples. Only a
     genuinely live read may contribute URLs. */
  const catalog = await getStorefrontCatalog().catch(() => null);
  const live = catalog?.live ? catalog : null;

  const categoryEntries: MetadataRoute.Sitemap = (live?.categories ?? []).map((c) => ({
    url: url(`/shop/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productEntries: MetadataRoute.Sitemap = (live?.products ?? []).map((p) => ({
    url: url(`/products/${p.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const farmEntries: MetadataRoute.Sitemap = FARMS.map((f) => ({
    url: url(`/farms/${f.id}`),
    lastModified: f.partneredSince ? new Date(f.partneredSince) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const journalEntries: MetadataRoute.Sitemap = JOURNAL.map((a) => ({
    url: url(`/journal/${a.slug}`),
    lastModified: a.publishedAt ? new Date(a.publishedAt) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries, ...farmEntries, ...journalEntries];
}
