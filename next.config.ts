import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // firebase-admin uses dynamic requires that Next's server bundler breaks,
  // which crashes (500) any route verifying ID tokens in production. Keeping it
  // external loads it as a normal Node module at runtime so those routes work.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
