import { currentAdminSession } from "../../guard";
import { snoozeTotpPrompt } from "@/lib/admin-security";

/**
 * POST /api/admin/me/totp/snooze { mode } — defer the enrollment prompt.
 * "skip" → remind again in 7 days; anything else ("later") → 2 days.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  let mode: unknown;
  try {
    mode = (await request.json())?.mode;
  } catch {
    mode = "later";
  }
  const days = mode === "skip" ? 7 : 2;
  await snoozeTotpPrompt(session.email, days);
  return Response.json({ ok: true, days });
}
