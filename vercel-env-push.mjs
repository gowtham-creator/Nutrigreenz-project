// One-shot: push the Firebase/admin env vars from .env.local into Vercel
// (Production + Preview). Run from the repo root AFTER `vercel login` + `vercel link`.
//   node vercel-env-push.mjs
// Then deploy:  vercel --prod
import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";

loadEnvConfig(process.cwd());

const KEYS = [
  // Public Firebase web config (safe to expose)
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  // Server-only secrets
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSCODE",
  "ADMIN_SESSION_SECRET",
  "ADMIN_PHONE",
  "STAFF_ADMIN_EMAIL",
  "STAFF_ADMIN_PASSCODE",
];

for (const target of ["production", "preview"]) {
  for (const key of KEYS) {
    const value = process.env[key];
    if (!value) { console.log("skip (unset):", key); continue; }
    // Remove any existing value first so re-runs don't error, then add.
    spawnSync("vercel", ["env", "rm", key, target, "-y"], { stdio: "ignore" });
    const r = spawnSync("vercel", ["env", "add", key, target], { input: value, encoding: "utf8" });
    console.log(r.status === 0 ? "  set " : "  FAIL", target.padEnd(10), key);
  }
}
console.log("\nDone. Now deploy:  vercel --prod");
