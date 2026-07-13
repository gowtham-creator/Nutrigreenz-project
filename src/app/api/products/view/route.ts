/**
 * POST /api/products/view — best-effort storefront PDP view ping.
 *
 * No auth: the storefront fires this on product-detail mount to record one
 * `public.product_views` row for the admin analytics surface. It is deliberately
 * fire-and-forget — it validates the `productId` is a UUID, writes via the
 * service-role client, and NEVER throws or surfaces an error to the browser
 * (telemetry must never break the storefront). Always responds `204 No Content`.
 */
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noContent = () => new Response(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isSupabaseConfigured) return noContent();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
    if (!UUID_RE.test(productId)) return noContent();

    // Optional opaque session id for coarse de-duplication; bounded length.
    const sessionId =
      typeof body?.sessionId === "string" && body.sessionId.trim().length > 0
        ? body.sessionId.trim().slice(0, 128)
        : null;

    await supabaseAdmin().from("product_views").insert({ product_id: productId, session_id: sessionId });
  } catch {
    // Swallow everything — a telemetry write must never surface to the client.
  }
  return noContent();
}
