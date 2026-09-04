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
  plainMultiline,
  plainText,
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
    title: plainText(body.title, TEXT_LIMITS.name),
    slug: typeof body.slug === "string" ? plainText(body.slug, TEXT_LIMITS.slug) : undefined,
    excerpt: typeof body.excerpt === "string" ? plainText(body.excerpt, 300) : undefined,
    /* The article body is long-form prose written by an operator, so line
       structure is kept — but tags and template delimiters still come out. */
    body: typeof body.body === "string" ? plainMultiline(body.body, 20000) : undefined,
    cover,
    author: typeof body.author === "string" ? plainText(body.author, TEXT_LIMITS.name) : undefined,
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
    name: plainText(body.name, TEXT_LIMITS.name),
    region: typeof body.region === "string" ? plainText(body.region, TEXT_LIMITS.area) : undefined,
    hectares,
    practices: body.practices !== undefined ? toStringArray(body.practices) : undefined,
    partneredSince: typeof body.partneredSince === "string" ? body.partneredSince : undefined,
    farmerName:
      typeof body.farmerName === "string" ? plainText(body.farmerName, TEXT_LIMITS.name) : undefined,
    story: typeof body.story === "string" ? plainMultiline(body.story, 5000) : undefined,
    image,
    gallery: body.gallery !== undefined ? toStringArray(body.gallery) : undefined,
    sort: nonNegativeInt(body.sort),
  };
}
