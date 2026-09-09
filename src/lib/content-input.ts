/**
 * Request-body → input parsers for the Journal / Farms admin APIs. Kept in a
 * neutral module (not a `route.ts`) so both the collection and item routes can
 * share them without importing from one another. Type-only import of the input
 * shapes keeps this file free of the server-only `content` runtime.
 */
import type { JournalInput, FarmInput } from "@/lib/content";
import {
  TEXT_LIMITS,
  nonNegativeInt,
  nonNegativeNumber,
  oneOf,
  plainText,
  strictMultiline,
  strictText,
} from "@/lib/sanitize-text";

/**
 * The categories the Journal actually publishes under, mirroring the filter
 * strip on /journal. The API previously accepted any string, so a request
 * could store a category that no page lists and no filter matches.
 */
export const JOURNAL_CATEGORIES = ["Science", "Field notes", "Recipes", "Guides"] as const;

/** Coerce a field that may arrive as an array or comma-separated string. */
export function toStringArray(v: unknown): string[] {
  /* Members are operator free text (farm practices, article tags), so they get
     the same treatment as any other stored string, and the array itself is
     capped — an unbounded list is the same DoS surface as an unbounded
     string. */
  const clean = (x: unknown) => plainText(x, TEXT_LIMITS.label);
  if (Array.isArray(v)) return v.slice(0, 50).map(clean).filter(Boolean);
  if (typeof v === "string") return v.split(",").slice(0, 50).map(clean).filter(Boolean);
  return [];
}

/** Build a JournalInput from a request body (shared by POST + PATCH). */
export function journalDraftFromBody(body: Record<string, unknown>): JournalInput {
  const cover =
    typeof body.cover === "string"
      ? body.cover
      : typeof body.imageUrl === "string"
        ? body.imageUrl
        : undefined;
  return {
    /* Over-length values are REFUSED here rather than trimmed to fit. Silent
       truncation returned 200 and a "Article updated" toast while cutting the
       operator's text at 120 characters, which is both the audit finding and
       the worse outcome for the person using the form. */
    title: strictText(body.title, TEXT_LIMITS.name, "Title"),
    slug: typeof body.slug === "string" ? strictText(body.slug, TEXT_LIMITS.slug, "Slug") : undefined,
    excerpt: typeof body.excerpt === "string" ? strictText(body.excerpt, 300, "Excerpt") : undefined,
    /* The article body is long-form prose written by an operator, so line
       structure is kept — but tags and template delimiters still come out. */
    body: typeof body.body === "string" ? strictMultiline(body.body, 20000, "Body") : undefined,
    cover,
    author: typeof body.author === "string" ? strictText(body.author, TEXT_LIMITS.name, "Author") : undefined,
    category: oneOf(body.category, JOURNAL_CATEGORIES),
    readMinutes: nonNegativeInt(body.readMinutes),
    tags: body.tags !== undefined ? toStringArray(body.tags) : undefined,
    publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : undefined,
    sort: nonNegativeInt(body.sort),
  };
}

/** Build a FarmInput from a request body (shared by POST + PATCH). */
export function farmDraftFromBody(body: Record<string, unknown>): FarmInput {
  const image =
    typeof body.image === "string"
      ? body.image
      : typeof body.imageUrl === "string"
        ? body.imageUrl
        : undefined;
  /* Explicit null clears the field; anything else must be a non-negative
     number. A negative area is what Entersoft submitted and stored. */
  const rawHectares = body.hectares;
  const hectares =
    rawHectares === null || rawHectares === "" ? null : nonNegativeNumber(rawHectares);
  return {
    name: strictText(body.name, TEXT_LIMITS.name, "Farm name"),
    region:
      typeof body.region === "string" ? strictText(body.region, TEXT_LIMITS.area, "Region") : undefined,
    hectares,
    practices: body.practices !== undefined ? toStringArray(body.practices) : undefined,
    partneredSince: typeof body.partneredSince === "string" ? body.partneredSince : undefined,
    farmerName:
      typeof body.farmerName === "string"
        ? strictText(body.farmerName, TEXT_LIMITS.name, "Farmer name")
        : undefined,
    story: typeof body.story === "string" ? strictMultiline(body.story, 5000, "Story") : undefined,
    image,
    gallery: body.gallery !== undefined ? toStringArray(body.gallery) : undefined,
    sort: nonNegativeInt(body.sort),
  };
}
