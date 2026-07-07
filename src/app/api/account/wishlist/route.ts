/**
 * GET    /api/account/wishlist                 — the signed-in customer's saved
 *                                                products (hydrated ProductCards,
 *                                                newest saved first).
 * POST   /api/account/wishlist { productSlug } — save one product (idempotent).
 * POST   /api/account/wishlist { slugs: [...] }— bulk-merge many (sign-in fold-in).
 * DELETE /api/account/wishlist { productSlug } — remove one saved product.
 * DELETE /api/account/wishlist?all=1           — clear the whole wishlist.
 *
 * Server-owned wishlist (Slice 2). Rows are attached to the CANONICAL
 * `public.customers` row so saves are shared across a person's Google + phone
 * sign-ins and durable across devices. Auth is the signed `ng_session` cookie,
 * resolved to the owning `customer_id` via {@link getCustomerSession}; every
 * operation is scoped strictly to that customer. Guests keep using the client
 * localStorage store — this API is for signed-in customers only.
 */
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { getCustomerSession } from "@/lib/customer-session";
import {
  addManyToWishlist,
  addToWishlist,
  clearWishlist,
  listWishlistProducts,
  removeFromWishlist,
} from "@/lib/wishlist-store";

// supabase-admin + firebase-admin (jose, via session) need the Node runtime.
export const runtime = "nodejs";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, items: [] });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const items = await listWishlistProducts(session.customerId);
  return Response.json({ ok: true, items });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // Bulk merge (sign-in fold-in): `{ slugs: string[] }`.
  if (Array.isArray(b.slugs)) {
    const slugs = b.slugs.filter((s): s is string => typeof s === "string");
    const ok = await addManyToWishlist(session.customerId, slugs);
    if (!ok) return Response.json({ ok: false, error: "save-failed" }, { status: 500 });
    const items = await listWishlistProducts(session.customerId);
    return Response.json({ ok: true, items });
  }

  // Single save: `{ productSlug }`.
  const slug = str(b.productSlug) ?? str(b.slug);
  if (!slug) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const ok = await addToWishlist(session.customerId, slug);
  if (!ok) return Response.json({ ok: false, error: "save-failed" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("all") === "1") {
    const ok = await clearWishlist(session.customerId);
    if (!ok) return Response.json({ ok: false, error: "clear-failed" }, { status: 500 });
    return Response.json({ ok: true });
  }

  // Accept the slug from the query string or a JSON body.
  let slug = str(url.searchParams.get("slug"));
  if (!slug) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      slug = str(body.productSlug) ?? str(body.slug);
    } catch {
      /* no body — fall through to the bad-request below */
    }
  }
  if (!slug) {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }
  const ok = await removeFromWishlist(session.customerId, slug);
  if (!ok) return Response.json({ ok: false, error: "delete-failed" }, { status: 500 });
  return Response.json({ ok: true });
}
