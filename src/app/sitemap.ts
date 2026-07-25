import type { MetadataRoute } from "next";
import { CATEGORIES, PRODUCTS, FARMS, JOURNAL } from "@/components/ng/data";

/** Public base URL for absolute sitemap entries. */
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutrigreenz.farm").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
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
  ];

  const categoryEntries: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: url(`/shop/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productEntries: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
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
