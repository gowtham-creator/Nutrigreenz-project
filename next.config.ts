import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin uses dynamic requires that Next's server bundler breaks,
  // which crashes (500) any route verifying ID tokens in production. Keeping it
  // external loads it as a normal Node module at runtime so those routes work.
  // NOTE: do NOT set `output: "standalone"` here — on Vercel it conflicts with
  // the platform's own function tracing and ships an incomplete bundle that
  // 500s on firebase-admin. Vercel handles output/tracing natively.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
