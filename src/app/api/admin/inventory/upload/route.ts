/**
 * POST /api/admin/inventory/upload — admin-gated product image upload.
 *
 * Accepts a multipart form with a single `file` (jpg/png/webp, ≤5 MB), writes
 * it to the public `product-images` bucket via the service-role storage client
 * (which bypasses RLS, so no extra storage policy is needed), and returns the
 * public URL for the caller to store in `product.image_url`.
 *
 * Gated by the same inventory guard as the rest of the portal: any signed-in
 * admin or super-admin may upload. The service-role key never leaves the
 * server — this route is Node-runtime only.
 */
import { isSignedInAdmin } from "../guard";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // ~5 MB cap

/** Allowed MIME types → file extension used in the storage key. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Slugify the original filename into a safe, short key fragment. */
function slugifyName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "image";
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "no-file" }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return Response.json({ ok: false, error: "unsupported-type" }, { status: 415 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "too-large" }, { status: 413 });
  }

  const key = `products/${Date.now()}-${slugifyName(file.name)}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    return Response.json({ ok: false, error: "upload-failed" }, { status: 502 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return Response.json({ ok: true, url: data.publicUrl });
}
