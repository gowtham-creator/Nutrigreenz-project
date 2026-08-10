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
import sharp from "sharp";
import { requireApiPermission } from "@/lib/admin-api-guard";

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
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
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

  /*
   * Normalise every upload to one canvas before it is stored.
   *
   * The product gallery lays its slides out square. An operator uploading a
   * portrait phone photo next to a square studio render previously got exactly
   * that — one slide letterboxed with grey bars, the next full-bleed — and
   * nothing in the admin hinted at it, because the thumbnail is square either
   * way.
   *
   * `contain` rather than `cover`: cropping a product shot to fill a square is
   * how a bottle loses its cap or a label loses its edge, and a shopper
   * checking a pack cannot be shown a cropped one. The spare area is filled
   * with the brand cream the gallery already sits on, so the pad is invisible
   * rather than a grey bar.
   *
   * webp at 88 because these are photographs served at 1200px; the format saves
   * roughly a third over JPEG at a quality difference no one can see on a
   * product shot.
   */
  const SLIDE = 1200;
  const CREAM = { r: 249, g: 250, b: 245 };

  let bytes: Uint8Array;
  let storedType = "image/webp";
  let storedExt = "webp";
  try {
    const normalised = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // honour EXIF orientation, or phone uploads land sideways
      .resize(SLIDE, SLIDE, { fit: "contain", background: CREAM })
      .webp({ quality: 88 })
      .toBuffer();
    bytes = new Uint8Array(normalised);
  } catch {
    // An image sharp cannot decode is stored as-is rather than rejected — the
    // operator still gets their file, just without the normalisation.
    bytes = new Uint8Array(await file.arrayBuffer());
    storedType = file.type;
    storedExt = ext;
  }

  const key = `products/${Date.now()}-${slugifyName(file.name)}.${storedExt}`;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, {
    contentType: storedType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    return Response.json({ ok: false, error: "upload-failed" }, { status: 502 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return Response.json({ ok: true, url: data.publicUrl });
}
