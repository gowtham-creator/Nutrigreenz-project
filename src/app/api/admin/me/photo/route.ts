/**
 * POST   /api/admin/me/photo — upload the signed-in operator's avatar.
 * DELETE /api/admin/me/photo — clear it.
 *
 * Accepts EITHER a multipart form with a `file`, OR a JSON `{ dataUrl }`
 * (base64 data URL, as produced by the browser's FileReader). The image is
 * validated (image type, ≤5 MB) and written to the public `avatars` bucket at a
 * stable key `avatars/<adminId>.<ext>` (upsert), then the resulting public URL
 * (cache-busted) is stored on `admins.photo_url`.
 *
 * Identity comes from the signed session (see `../guard`); the admin id is
 * resolved server-side from that email, so a caller can only ever change their
 * own photo. Service-role storage writes bypass RLS, so the bucket needs no
 * extra policy — mirroring the `product-images` upload route. Node runtime.
 */
import { currentAdminSession } from "../guard";
import { getAdminByEmail, updateAdminProfile } from "@/lib/admins";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // ~5 MB cap

/** Allowed image MIME types → the file extension used in the storage key. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

interface DecodedImage {
  bytes: Uint8Array;
  mime: string;
}

/** Parse a base64 data URL into raw bytes + MIME, or null when malformed. */
function decodeDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return { bytes: new Uint8Array(Buffer.from(match[2], "base64")), mime: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

/** Recover the storage key from a stored public URL, or null. */
function storageKeyFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const rest = url.slice(i + marker.length);
  const q = rest.indexOf("?");
  const key = q === -1 ? rest : rest.slice(0, q);
  return key || null;
}

export async function POST(request: Request): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  // Ensure the operator has a profile row (creates one for an env-only admin) so
  // there's a stable id to key the avatar object on and a row to save the URL to.
  const admin = await updateAdminProfile({ email: session.email, role: session.role });
  if (!admin) return Response.json({ ok: false, error: "save-failed" }, { status: 500 });

  // Read the image from whichever transport the client used.
  let bytes: Uint8Array;
  let mime: string;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
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
    bytes = new Uint8Array(await file.arrayBuffer());
    mime = file.type.toLowerCase();
  } else {
    let body: { dataUrl?: unknown };
    try {
      body = (await request.json()) as { dataUrl?: unknown };
    } catch {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    if (typeof body.dataUrl !== "string") {
      return Response.json({ ok: false, error: "no-file" }, { status: 400 });
    }
    const decoded = decodeDataUrl(body.dataUrl);
    if (!decoded) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    bytes = decoded.bytes;
    mime = decoded.mime;
  }

  const ext = ALLOWED[mime];
  if (!ext) return Response.json({ ok: false, error: "unsupported-type" }, { status: 415 });
  if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
    return Response.json({ ok: false, error: "too-large" }, { status: 413 });
  }

  const key = `${admin.id}.${ext}`;
  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) return Response.json({ ok: false, error: "upload-failed" }, { status: 502 });

  // Cache-bust: the key is stable across re-uploads, so the public URL is too —
  // a version query param forces browsers to fetch the freshly-uploaded image.
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  const photoUrl = `${data.publicUrl}?v=${Date.now()}`;

  await updateAdminProfile({ email: session.email, role: session.role, photoUrl });
  await logActivity({
    actorEmail: session.email,
    actorRole: session.role,
    action: "admin.photo_update",
    target: session.email,
    meta: null,
  });

  return Response.json({ ok: true, photoUrl });
}

export async function DELETE(): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const admin = await getAdminByEmail(session.email);
  if (!admin) return Response.json({ ok: true }); // nothing to clear

  // Best-effort remove the stored object, then null the column regardless.
  if (admin.photoUrl) {
    const key = storageKeyFromUrl(admin.photoUrl);
    if (key) {
      try {
        await supabaseAdmin().storage.from(BUCKET).remove([key]);
      } catch {
        /* best-effort — clearing the column is what matters */
      }
    }
  }

  await updateAdminProfile({ email: session.email, photoUrl: null });
  if (admin.photoUrl) {
    await logActivity({
      actorEmail: session.email,
      actorRole: session.role,
      action: "admin.photo_remove",
      target: session.email,
      meta: null,
    });
  }

  return Response.json({ ok: true });
}
