/**
 * TEMPORARY diagnostic — confirms whether the running server can see the admin
 * env vars, and which commit is live. Reports PRESENCE ONLY (booleans), never
 * the actual values, so it's safe to hit. Remove once the admin login is
 * confirmed working in production.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    deployedAt: new Date().toISOString(),
    env: {
      ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
      ADMIN_PASSCODE: Boolean(process.env.ADMIN_PASSCODE),
      ADMIN_SESSION_SECRET: Boolean(process.env.ADMIN_SESSION_SECRET),
    },
  });
}
