import { requireSuperAdmin } from "../../guard";
import { TEXT_LIMITS, strictText } from "@/lib/sanitize-text";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listDeliverySlots, createSlot } from "@/lib/commerce-rules";
import { withLengthValidation } from "@/lib/input-validation-guard";

/** GET — list all delivery slots. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const slots = await listDeliverySlots();
  return Response.json({ ok: true, slots });
}

/** POST — create a delivery slot. Super-admin only. */
async function POSTHandler(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const label = strictText(body.label, TEXT_LIMITS.label, "Label");
  if (!label) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const windowText = body.windowText !== undefined ? String(body.windowText) : undefined;
  const sort = Number.isFinite(Number(body.sort)) ? Number(body.sort) : undefined;
  const active = typeof body.active === "boolean" ? body.active : undefined;

  try {
    const slot = await createSlot({ label, windowText, sort, active });
    return Response.json({ ok: true, slot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}


export const POST = withLengthValidation(POSTHandler);
