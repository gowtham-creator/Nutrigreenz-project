import type { ReactNode } from "react";
import { CaptainStoreProvider } from "@/components/ng/captain/captain-store";

export const metadata = {
  title: "Captain | NutriGreenz",
  description:
    "Record stall sales, handle community pickups and settle your cash and UPI at the end of the day.",
};

export default function CaptainLayout({ children }: { children: ReactNode }) {
  return <CaptainStoreProvider>{children}</CaptainStoreProvider>;
}
