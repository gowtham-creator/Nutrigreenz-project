import type { MetadataRoute } from "next";

/** Public base URL used to reference the sitemap. */
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutrigreenz.farm").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep internal, authenticated and operational areas out of the index.
      disallow: ["/admin", "/account", "/checkout", "/captain", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
