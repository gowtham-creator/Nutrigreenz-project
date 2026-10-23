import type { Metadata } from "next";
import { FSSAI_LICENCE } from "@/components/ng/fssai-mark";

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

/** Longest title in the list that fits a results snippet (60 chars), else the last. */
export function fitTitle(...candidates: string[]): string {
  return candidates.find((t) => t.length <= 60) ?? candidates[candidates.length - 1];
}

export const ORG_ID = `${SITE_URL}/#organization`;

/**
 * The facts that identify the business, in one place.
 *
 * AI answers were mixing Nutri Greenz up with microgreens sellers that have
 * similar names, and the site gave them little to go on: the footer listed a
 * different office from the invoices and linked to social handles owned by
 * someone else. Every page, the structured data and /llms.txt now read the same
 * facts from here, so search engines see one business described one way.
 */
export const BRAND = {
  name: SITE_NAME,
  alternateNames: ["NutriGreenz", "Nutri Greenz Farm"],
  legalName: "Nutri Greenz Farm Technologies Private Limited",
  /** Corporate Identification Number, Ministry of Corporate Affairs. */
  cin: "U46305TS2026PTC210934",
  fssai: FSSAI_LICENCE,
  telephone: "+91 94918 93370",
  email: "customersupport@nutrigreenz.farm",
  address: {
    streetAddress: "1st Floor, H.No. 5-35/167, Double Road, Prashanth Nagar, Kukatpally",
    addressLocality: "Hyderabad",
    addressRegion: "Telangana",
    postalCode: "500072",
    addressCountry: "IN",
  },
  /** One sentence that answers "what is Nutri Greenz?". */
  summary:
    "Nutri Greenz is a Hyderabad food brand that sells cold-pressed oils, A2 ghee and raw honey from named partner farms, online at nutrigreenz.farm with delivery across Hyderabad.",
  disambiguation:
    "Nutri Greenz (nutrigreenz.farm) is not connected with Nutrigreen, Nutrigreens or other similarly named microgreens and health-food businesses.",
} as const;

/**
 * The brand's own social profiles, for `sameAs` and the footer icons.
 *
 * Empty until the accounts exist. The footer used to point at guessed handles
 * (x.com/nutrigreenz belongs to an unrelated account), which told search
 * engines that someone else's profile was ours. Add real URLs here only.
 */
export const SOCIAL_PROFILES: readonly { label: string; icon: string; href: string }[] = [];

/** The business, as Google and AI search should know it. Every value is shown on the site. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  "@id": ORG_ID,
  name: BRAND.name,
  alternateName: BRAND.alternateNames,
  legalName: BRAND.legalName,
  description: BRAND.summary,
  disambiguatingDescription: BRAND.disambiguation,
  url: SITE_URL,
  logo: `${SITE_URL}/images/brand/logo-horizontal.png`,
  image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
  telephone: BRAND.telephone,
  email: BRAND.email,
  address: { "@type": "PostalAddress", ...BRAND.address },
  areaServed: { "@type": "City", name: "Hyderabad" },
  knowsAbout: ["Cold-pressed oil", "Wood-pressed oil", "A2 ghee", "Bilona ghee", "Raw honey"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: BRAND.telephone,
    email: BRAND.email,
    areaServed: "IN",
  },
  identifier: [
    { "@type": "PropertyValue", propertyID: "CIN", value: BRAND.cin },
    ...(BRAND.fssai ? [{ "@type": "PropertyValue", propertyID: "FSSAI licence", value: BRAND.fssai }] : []),
  ],
  ...(SOCIAL_PROFILES.length > 0 ? { sameAs: SOCIAL_PROFILES.map((s) => s.href) } : {}),
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: BRAND.alternateNames,
  url: SITE_URL,
  inLanguage: "en-IN",
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
  /** Last edit, ISO. Falls back to the publish date. */
  updatedAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.description,
    image: [a.image.startsWith("http") ? a.image : `${SITE_URL}${a.image}`],
    datePublished: a.publishedAt,
    dateModified: a.updatedAt || a.publishedAt,
    author: a.author ? { "@type": "Person", name: a.author } : { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: `${SITE_URL}${a.path}`,
  };
}

/** The products on a category page, in the order they are shown. */
export function itemListJsonLd(list: { name: string; path: string; items: { name: string; path: string }[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.name,
    url: `${SITE_URL}${list.path}`,
    numberOfItems: list.items.length,
    itemListElement: list.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}
