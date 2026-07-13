import { currentAdminSession } from "../guard";
import { getTotpEnrollment } from "@/lib/admin-security";

/**
 * GET /api/admin/me/totp — the signed-in admin's authenticator state.
 * `promptDue` drives the post-login "set up an authenticator" prompt: true when
 * they aren't enrolled and haven't snoozed the prompt past `now`.
 */
export async function GET(): Promise<Response> {
  const session = await currentAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });

  const e = await getTotpEnrollment(session.email);
  const snoozed = e.snoozeUntil ? new Date(e.snoozeUntil).getTime() > Date.now() : false;
  // Prompt only when the authenticator factor was ASSIGNED to this admin but they
  // haven't enrolled their own secret yet (and haven't snoozed the nudge).
  return Response.json({
    ok: true,
    enrolled: e.enrolled,
    promptDue: e.assigned && !e.enrolled && !snoozed,
  });
}
