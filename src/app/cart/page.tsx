import type { Metadata } from "next";
import { PageShell } from "@/components/ng/page-shell";
import { CartView } from "@/components/ng/cart/cart-view";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "Your bag · Nutri Greenz",
  description: "Review the single-origin staples in your bag and proceed to checkout.",
};

export default function CartPage() {
  return (
    <PageShell>
      <CartView />
    </PageShell>
  );
}
