import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { verifyToken } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { broadcastCampaign } from "@/lib/broadcast";
import { logActivity } from "@/lib/activity-log";
import type { NotifyChannel, NotifyType } from "@/lib/notification-templates";

export const runtime = "nodejs";

const MARKETING_TYPES: NotifyType[] = ["promotion", "campaign", "offer"];
const CHANNELS: NotifyChannel[] = ["email", "sms", "whatsapp"];

/** The signed-in super-admin's email, or null. */
async function superAdminEmail(): Promise<string | null> {
  const session = await verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);
  return session && session.role === "superadmin" ? session.email : null;
}

/**
 * POST /api/admin/marketing/broadcast — super-admin only.
 *
 * Sends a promotion / campaign / offer to every onboarded customer on the chosen
 * channels. Body: { type, channels[], vars }. Best-effort; returns per-channel
 * sent/skipped counts. SMS/WhatsApp channels no-op until MSG91/WhatsApp is live.
 */
export async function POST(request: Request): Promise<Response> {
  const actor = await superAdminEmail();
  if (!actor) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const type = String(body.type ?? "") as NotifyType;
  if (!MARKETING_TYPES.includes(type)) {
    return Response.json({ ok: false, error: "invalid-type" }, { status: 400 });
  }
  const channels = (Array.isArray(body.channels) ? body.channels : [])
    .map(String)
    .filter((c): c is NotifyChannel => CHANNELS.includes(c as NotifyChannel));
  if (channels.length === 0) {
    return Response.json({ ok: false, error: "no-channels" }, { status: 400 });
  }
  const vars = typeof body.vars === "object" && body.vars ? (body.vars as Record<string, string>) : {};

  const result = await broadcastCampaign({ type, channels, vars });

  await logActivity({
    actorEmail: actor,
    actorRole: "superadmin",
    action: "marketing.broadcast",
    meta: { type, channels, audience: result.audience },
  });

  return Response.json({ ok: true, result });
}
