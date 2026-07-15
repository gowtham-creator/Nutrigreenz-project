import { clearCaptainSession } from "@/lib/captain-session";

/**
 * POST /api/captain/logout — sign the captain out by expiring the httpOnly
 * `ng_captain` session cookie (only the server can clear it). Always 200.
 */
export async function POST(): Promise<Response> {
  await clearCaptainSession();
  return Response.json({ ok: true });
}
