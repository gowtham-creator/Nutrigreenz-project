// TEMPORARY diagnostics for the firebase-admin 500 on Vercel. Reports only
// presence flags + the public key header + the failing step/error — never any
// secret value. Remove immediately after reading.
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const env = {
    hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    keyHeader: (process.env.FIREBASE_PRIVATE_KEY || "").slice(0, 27),
    keyLen: (process.env.FIREBASE_PRIVATE_KEY || "").length,
    keyHasEscapedNL: (process.env.FIREBASE_PRIVATE_KEY || "").includes("\\n"),
    keyHasRealNL: (process.env.FIREBASE_PRIVATE_KEY || "").includes("\n"),
    nodeVersion: process.version,
  };
  let step = "start";
  try {
    step = "import-app";
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    step = "import-auth";
    const { getAuth } = await import("firebase-admin/auth");
    step = "init-app";
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    step = "verify";
    let verifyError = "";
    try {
      await getAuth(app).verifyIdToken("dummy");
    } catch (e) {
      verifyError = String((e as Error)?.message || e).slice(0, 200);
    }
    return Response.json({ ok: true, step: "verify-reached", env, verifyError });
  } catch (err) {
    return Response.json({
      ok: false,
      failedStep: step,
      env,
      error: String((err as Error)?.message || err).slice(0, 300),
      stack: String((err as Error)?.stack || "")
        .split("\n")
        .slice(0, 8),
    });
  }
}
