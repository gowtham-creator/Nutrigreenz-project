import type { Metadata } from "next";

/**
 * Search and share metadata in one place.
 *
 * Next.js inherits `openGraph`, `twitter` and `alternates` from the root layout
 * wholesale, so a canonical set there would point every page at the home page.
 * Each indexable page builds its own with `pageMeta()` instead.
 */
export const SITE_URL = "https://nutrigreenz.farm";
export const SITE_NAME = "Nutri Greenz";
export const DEFAULT_OG_IMAGE = "/images/og/nutri-greenz-og.jpg";

export function pageMeta({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  /** Route path starting with "/", e.g. "/shop/oils". */
  path: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const images = [image || DEFAULT_OG_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type, url, title, description, siteName: SITE_NAME, locale: "en_IN", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

const ORG_ID = `${SITE_URL}/#organization`;

/** The business, as Google and AI search should know it. Every value is shown on the site. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE_NAME,
  alternateName: "NutriGreenz",
  legalName: "Nutri Greenz Farm Technologies Private Limited",
  url: SITE_URL,
  logo: `${SITE_URL}/images/brand/logo-horizontal.png`,
  telephone: "+91 94918 93370",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Prashanth Nagar, Kukatpally",
    addressLocality: "Hyderabad",
    addressRegion: "Telangana",
    postalCode: "500072",
    addressCountry: "IN",
  },
  identifier: { "@type": "PropertyValue", propertyID: "FSSAI licence", value: "10024051000987" },
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: ["NutriGreenz", "Nutri Greenz Farm"],
  url: SITE_URL,
  publisher: { "@id": ORG_ID },
};

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path === "/" ? SITE_URL : `${SITE_URL}${item.path}`,
    })),
  };
}

export function articleJsonLd(a: {
  title: string;
  description: string;
  path: string;
  image: string;
  author: string;
  publishedAt: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    image: [a.image.startsWith("http") ? a.image : `${SITE_URL}${a.image}`],
    datePublished: a.publishedAt,
    author: a.author ? { "@type": "Person", name: a.author } : { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: `${SITE_URL}${a.path}`,
  };
}
