import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Token verification is done with `jose` (see src/lib/firebase-admin.ts), so
  // no firebase-admin externalisation or `output: "standalone"` is needed.
};

export default nextConfig;
