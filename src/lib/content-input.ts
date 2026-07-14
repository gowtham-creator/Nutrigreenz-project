/**
 * Request-body → input parsers for the Journal / Farms admin APIs. Kept in a
 * neutral module (not a `route.ts`) so both the collection and item routes can
 * share them without importing from one another. Type-only import of the input
 * shapes keeps this file free of the server-only `content` runtime.
 */
import type { JournalInput, FarmInput } from "@/lib/content";

/** Coerce a field that may arrive as an array or comma-separated string. */
export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
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
    title: String(body.title ?? "").trim(),
    slug: typeof body.slug === "string" ? body.slug.trim() : undefined,
    excerpt: typeof body.excerpt === "string" ? body.excerpt : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    cover,
    author: typeof body.author === "string" ? body.author : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    readMinutes: Number.isFinite(Number(body.readMinutes)) ? Number(body.readMinutes) : undefined,
    tags: body.tags !== undefined ? toStringArray(body.tags) : undefined,
    publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : undefined,
    sort: Number.isFinite(Number(body.sort)) ? Number(body.sort) : undefined,
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
  const rawHectares = body.hectares;
  const hectares =
    rawHectares === null || rawHectares === ""
      ? null
      : Number.isFinite(Number(rawHectares))
        ? Number(rawHectares)
        : undefined;
  return {
    name: String(body.name ?? "").trim(),
    region: typeof body.region === "string" ? body.region : undefined,
    hectares,
    practices: body.practices !== undefined ? toStringArray(body.practices) : undefined,
    partneredSince: typeof body.partneredSince === "string" ? body.partneredSince : undefined,
    farmerName: typeof body.farmerName === "string" ? body.farmerName : undefined,
    story: typeof body.story === "string" ? body.story : undefined,
    image,
    gallery: body.gallery !== undefined ? toStringArray(body.gallery) : undefined,
    sort: Number.isFinite(Number(body.sort)) ? Number(body.sort) : undefined,
  };
}
