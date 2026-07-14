import { isSignedInAdmin } from "../../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { setVariantStock } from "@/lib/catalog";
import { requireApiPermission } from "@/lib/admin-api-guard";

type Ctx = { params: Promise<{ id: string }> };

/** PUT — set a variant's absolute stock (and optionally reserved). */
export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const stock = Number(body.stock);
  if (!Number.isFinite(stock)) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const reserved = Number.isFinite(Number(body.reserved)) ? Number(body.reserved) : undefined;

  const variant = await setVariantStock(id, stock, reserved);
  if (!variant) return Response.json({ ok: false, error: "not-found" }, { status: 404 });
  return Response.json({ ok: true, variant });
}
