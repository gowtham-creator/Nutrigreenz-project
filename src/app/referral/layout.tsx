import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import { isReferralProgrammeOpen } from "@/lib/referrals";

// The gate has to run per request: built statically, it would answer once.
export const dynamic = "force-dynamic";

/*
 * /referral is a client page, so its metadata lives here.
 *
 * It shows a signed-in customer's own code and earnings, so there is nothing
 * for a search engine to index; until now it inherited the home page's title
 * and description and competed with it as a duplicate. Links on it are still
 * followed.
 */
export const metadata: Metadata = {
  ...pageMeta({
    title: "Refer & earn · Nutri Greenz",
    description: "Share your Nutri Greenz referral link and earn rewards when friends place their first order.",
    path: "/referral",
  }),
  robots: { index: false, follow: true },
};

export default async function ReferralLayout({ children }: { children: React.ReactNode }) {
  if (!(await isReferralProgrammeOpen())) notFound();
  return children;
}
