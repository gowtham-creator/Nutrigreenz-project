import type { ReactNode } from "react";
import { CaptainStoreProvider } from "@/components/ng/captain/captain-store";

export const metadata = {
  title: "Captain · Nutri Greenz field tool",
  description:
    "Field-agent PWA: capture stall customers, manage community pickups, and reconcile end-of-day cash & UPI.",
};

export default function CaptainLayout({ children }: { children: ReactNode }) {
  return <CaptainStoreProvider>{children}</CaptainStoreProvider>;
}
