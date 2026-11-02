import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CaptainStoreProvider } from "@/components/ng/captain/captain-store";
import { isFeatureEnabled } from "@/lib/feature-flags";

// The gate has to run per request: built statically, it would answer once.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Captain | NutriGreenz",
  description:
    "Record stall sales, handle community pickups and settle your cash and UPI at the end of the day.",
};

export default async function CaptainLayout({ children }: { children: ReactNode }) {
  if (!(await isFeatureEnabled("captain_network"))) notFound();
  return <CaptainStoreProvider>{children}</CaptainStoreProvider>;
}
