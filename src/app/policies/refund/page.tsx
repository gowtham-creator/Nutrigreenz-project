import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Cancellation & refund policy — Nutri Greenz",
  description:
    "Nutri Greenz operates a no-cancellation policy on confirmed orders. Refunds and replacements are offered only for damaged, spoiled or incorrect items. Here is how it works.",
};

export default function RefundPolicyPage() {
  return (
    <PolicyLayout
      activeHref="/policies/refund"
      title="Cancellation & refunds"
      intro="We harvest, mill and pack to order against fixed delivery slots. Because of that, confirmed orders cannot be cancelled — but we stand fully behind quality. Here is exactly when we refund or replace."
      updated="1 June 2026"
      sections={[
        {
          id: "no-cancellation",
          heading: "No-cancellation policy",
          body: (
            <>
              <p>
                <strong>Once an order is confirmed and paid, it cannot be cancelled or modified.</strong>{" "}
                We begin picking, milling and packing your produce against your chosen slot almost
                immediately, and perishable, single-origin items can&rsquo;t simply be returned to a
                shelf.
              </p>
              <p>
                Please review your cart, address and delivery slot carefully before paying. If you
                spot a genuine mistake within a few minutes of ordering, contact us at once on{" "}
                <a href="tel:+918888555411">+91 8888 555 411</a> and we&rsquo;ll help where the order
                has not yet entered packing — but this is a courtesy, not a guaranteed cancellation.
              </p>
            </>
          ),
        },
        {
          id: "when-we-refund",
          heading: "When you are entitled to a refund or replacement",
          body: (
            <>
              <p>
                We refund or replace, free of charge, when an item arrives:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li><strong>Damaged</strong> — e.g. a broken seal, leaking bottle or crushed pack.</li>
                <li><strong>Spoiled or expired</strong> — not in the fresh, usable condition we promise.</li>
                <li><strong>Incorrect</strong> — you received the wrong product, variant or quantity.</li>
                <li><strong>Missing</strong> — an item billed on your invoice was not in the box.</li>
              </ul>
              <p>
                Because our produce is fresh and food-grade, we cannot accept returns for change of
                mind, a disliked taste, or simply not needing an item after delivery.
              </p>
            </>
          ),
        },
        {
          id: "how-to-claim",
          heading: "How to raise a claim",
          body: (
            <>
              <p>
                Report any damaged, spoiled, incorrect or missing item within{" "}
                <strong>24 hours of delivery</strong>. The faster the better for perishables.
              </p>
              <ol className="list-decimal pl-5 flex flex-col gap-2">
                <li>
                  Email <a href="mailto:hello@nutrigreenz.in">hello@nutrigreenz.in</a> or WhatsApp/call{" "}
                  <a href="tel:+918888555411">+91 8888 555 411</a> with your order number.
                </li>
                <li>Attach a photo of the item and, where relevant, the lot code printed on the pack.</li>
                <li>Tell us whether you&rsquo;d prefer a replacement on your next slot or a refund.</li>
              </ol>
            </>
          ),
        },
        {
          id: "how-refunds-work",
          heading: "How refunds are processed",
          body: (
            <>
              <p>
                Once a claim is approved, refunds are issued to your original prepaid payment method.
                You can also choose to receive the amount as Nutri Greenz wallet credit, which lands
                instantly.
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li><strong>Wallet credit</strong> — instant.</li>
                <li><strong>UPI / cards / netbanking</strong> — typically 3&ndash;7 business days, depending on your bank.</li>
              </ul>
              <p>
                We are a prepaid-first store, so most refunds return cleanly to the source. For the
                rare cash-on-delivery order, refunds are issued as wallet credit or a bank transfer.
              </p>
            </>
          ),
        },
        {
          id: "loyalty",
          heading: "Loyalty points on refunds",
          body: (
            <p>
              If you earned <a href="/loyalty">loyalty points</a> on an order that is later refunded,
              the points earned on the refunded amount are reversed. Points already redeemed against a
              refunded order are credited back to your balance.
            </p>
          ),
        },
      ]}
    />
  );
}
