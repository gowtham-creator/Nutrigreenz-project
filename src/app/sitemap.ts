import type { MetadataRoute } from "next";
import { listFarms, listJournals } from "@/lib/content";
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
/** The newest of a set of dates, or undefined when none is known. */
function newest(dates: readonly (string | null | undefined)[]): Date | undefined {
  let best: number | null = null;
  for (const d of dates) {
    const t = d ? Date.parse(d) : NaN;
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best === null ? undefined : new Date(best);
}

/*
 * <lastmod> is a real edit date or nothing.
 *
 * Every entry used to carry the build time, so all 45 URLs claimed to have
 * changed on every deploy. Crawlers learn to ignore a lastmod that is always
 * "now". Products, categories, farms and articles now report when their record
 * last changed; static pages with no record behind them omit the field rather
 * than guess.
 *
 * /referral (a signed-in account page) and /sitemap (a page of links) are
 * noindexed, so they are no longer submitted either.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${BASE_URL}${path}`;

  /* `live` is false when the catalogue call fell through to the samples. Only a
     genuinely live read may contribute URLs. */
  const [catalog, farms, journals] = await Promise.all([
    getStorefrontCatalog().catch(() => null),
    listFarms().catch(() => []),
    listJournals().catch(() => []),
  ]);
  const live = catalog?.live ? catalog : null;
  const products = live?.products ?? [];
  const catalogUpdated = newest(products.map((p) => p.updatedAt));
  const farmsUpdated = newest(farms.map((f) => f.updatedAt));
  const journalUpdated = newest(journals.map((a) => a.updatedAt || a.publishedAt));

  const entry = (
    path: string,
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>,
    priority: number,
    lastModified?: Date,
  ): MetadataRoute.Sitemap[number] => ({
    url: url(path),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  });

  // Top-level marketing & commerce routes.
  const staticEntries: MetadataRoute.Sitemap = [
    entry("/", "daily", 1, catalogUpdated),
    entry("/shop", "daily", 0.9, catalogUpdated),
    entry("/farms", "weekly", 0.8, farmsUpdated),
    entry("/traceability", "monthly", 0.7),
    entry("/lab", "monthly", 0.7),
    entry("/journal", "weekly", 0.7, journalUpdated),
    entry("/about", "monthly", 0.7),
    entry("/faq", "monthly", 0.6),
    entry("/contact", "yearly", 0.6),
    entry("/wholesale", "monthly", 0.6),
    entry("/careers", "weekly", 0.5),
    entry("/press", "monthly", 0.5),
    entry("/loyalty", "monthly", 0.5),
    // Legal / policy
    entry("/policies/shipping", "yearly", 0.4),
    entry("/policies/refund", "yearly", 0.4),
    entry("/policies/privacy", "yearly", 0.4),
    entry("/policies/terms", "yearly", 0.4),
    entry("/policies/cookies", "yearly", 0.4),
    entry("/policies/attributions", "yearly", 0.4),
  ];

  const categoryEntries: MetadataRoute.Sitemap = (live?.categories ?? []).map((c) =>
    entry(
      `/shop/${c.slug}`,
      "weekly",
      0.8,
      newest(products.filter((p) => p.tags?.includes(c.slug)).map((p) => p.updatedAt)),
    ),
  );

  const productEntries: MetadataRoute.Sitemap = products.map((p) =>
    entry(`/products/${p.slug}`, "weekly", 0.7, newest([p.updatedAt])),
  );

  const farmEntries: MetadataRoute.Sitemap = farms.map((f) =>
    entry(`/farms/${f.id}`, "monthly", 0.6, newest([f.updatedAt])),
  );

  const journalEntries: MetadataRoute.Sitemap = journals.map((a) =>
    entry(`/journal/${a.slug}`, "monthly", 0.6, newest([a.updatedAt || a.publishedAt])),
  );

  return [...staticEntries, ...categoryEntries, ...productEntries, ...farmEntries, ...journalEntries];
}
