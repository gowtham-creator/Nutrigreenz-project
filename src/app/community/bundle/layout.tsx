import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";

// The gate has to run per request: built statically, it would answer once.
export const dynamic = "force-dynamic";

/** The whole community-bundle section sits behind its Super Admin switch. */
export default async function CommunityBundleLayout({ children }: { children: ReactNode }) {
  if (!(await isFeatureEnabled("community_bundles"))) notFound();
  return children;
}
