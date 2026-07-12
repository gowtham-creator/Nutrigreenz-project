import { listActiveAnnouncements } from "@/lib/announcements";

/**
 * Public evergreen marquee lines for the storefront top announcement bar — the
 * always-on shipping / new-arrival / membership notes, in display order. The
 * PromoBar fetches this on mount and renders these AFTER any live promotion
 * line; empty array when none are active.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const announcements = await listActiveAnnouncements().catch(() => []);
  const messages = announcements.map((a) => a.text);
  return Response.json(
    { messages },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
