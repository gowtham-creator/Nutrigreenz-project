/**
 * GET /api/admin/media — list previously-uploaded images in the shared
 * `product-images` bucket (the same bucket the inventory upload endpoint writes
 * to). Powers the "reuse an already-uploaded image" gallery in the Journal /
 * Farms image pickers, so an operator can pick an existing asset instead of
 * re-uploading. Admin-gated; the service-role key never leaves the server.
 */
import { isSignedInAdmin } from "./guard";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const PREFIX = "products";

export async function GET(): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: true, images: [] });

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw error;

    const images = (data ?? [])
      // Real files carry an id; folder placeholders / dotfiles do not.
      .filter((f) => Boolean(f.id) && !f.name.startsWith("."))
      .map((f) => {
        const { data: pub } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${PREFIX}/${f.name}`);
        return { name: f.name, url: pub.publicUrl };
      });

    return Response.json({ ok: true, images });
  } catch {
    return Response.json({ ok: true, images: [] });
  }
}
