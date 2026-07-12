import type { NextConfig } from "next";

// Hostname of the Supabase project, derived from the public URL so product
// images served from the public `product-images` bucket are allowed through
// `next/image`. Falls back to the known project ref host if the env is absent
// at build time (e.g. CI without env), so the build never fails on a bad URL.
const supabaseImageHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : "aawkgmfppmiqgxsukdpo.supabase.co";
  } catch {
    return "aawkgmfppmiqgxsukdpo.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  // Token verification is done with `jose` (see src/lib/firebase-admin.ts), so
  // no firebase-admin externalisation or `output: "standalone"` is needed.
  images: {
    // Allow higher-quality optimised variants (default is 75, which softens the
    // fine label detail on product shots at high-DPR mobile/tablet screens).
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
