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

  /**
   * Cache headers for everything under `public/`.
   *
   * This is a bandwidth fix, not a cosmetic one. Next serves files from
   * `public/` with `cache-control: public, max-age=0, must-revalidate` by
   * default — unlike `/_next/static/*`, which it fingerprints and marks
   * immutable. So every visit re-fetched every logo, hero and product photo
   * from the origin instead of reusing the copy the browser already had. With
   * ~7.7 MB of assets that is how a 10 GB origin-transfer allowance disappears
   * without any single file being large.
   *
   * These paths are safe to pin because their contents are replaced by
   * uploading a NEW file (the admin image picker writes to Supabase Storage
   * with a fresh name), not by overwriting an existing one. If a file at a
   * fixed path ever does need replacing in place, change its filename too —
   * that is the tradeoff `immutable` asks for.
   */
  async headers() {
    return [
      {
        source: "/:path((?:images|brand|videos|seo)/.*)",
        headers: [
          { key: "cache-control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  images: {
    // Allow higher-quality optimised variants (default is 75, which softens the
    // fine label detail on product shots at high-DPR mobile/tablet screens).
    qualities: [75, 90],
    /**
     * How long an OPTIMISED variant stays in the edge cache before Next
     * re-generates it at the origin. The default is short, so popular product
     * shots were being re-optimised and re-transferred repeatedly. Product
     * photography changes rarely, and when it does the URL changes with it.
     */
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost,
        pathname: "/storage/v1/object/public/**",
      },
      // Google account profile photos (Google sign-in). Google serves avatars
      // from rotating lh3/lh4/lh5… hosts, so the subdomain is wildcarded.
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
