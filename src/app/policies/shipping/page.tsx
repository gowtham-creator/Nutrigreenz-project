import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Shipping & delivery · Nutri Greenz",
  description: "How and when Nutri Greenz delivers across Hyderabad: delivery slots, free delivery on orders over ₹599, cold-chain handling and packaging.",
  path: "/policies/shipping",
});

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout
      activeHref="/policies/shipping"
      title="Shipping & delivery"
      intro="We deliver fresh, fully traceable produce across Hyderabad in fixed slots. This page explains how delivery works, what it costs and when to expect your box."
      updated="1 June 2026"
      sections={[
        {
          id: "where-we-deliver",
          heading: "Where we deliver",
          body: (
            <>
              <p>
                We currently deliver across <strong>Hyderabad and the surrounding Greater Hyderabad
                area</strong>, including Kukatpally, KPHB, Madhapur, Gachibowli, Kondapur, Miyapur,
                Banjara Hills, Jubilee Hills, Kphb Colony and most pincodes inside the ORR.
              </p>
              <p>
                Enter your pincode in the location bar at the top of the site to confirm we serve
                your area. If we don&rsquo;t reach you yet, leave your pincode and we&rsquo;ll notify
                you the day we go live there. We expand neighbourhood by neighbourhood so the
                cold-chain stays short.
              </p>
            </>
          ),
        },
        {
          id: "slots",
          heading: "Delivery slots",
          body: (
            <>
              <p>
                Orders are delivered in fixed slots so your produce spends as little time in transit
                as possible. At checkout you choose:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li><strong>Morning slot:</strong> 7:00 AM to 11:00 AM</li>
                <li><strong>Evening slot:</strong> 5:00 PM to 9:00 PM</li>
              </ul>
              <p>
                Place your order before <strong>9:00 PM</strong> for next-day delivery in most
                Hyderabad pincodes. Perishables and freshly milled flours are dispatched the morning
                they leave our Kukatpally hub.
              </p>
            </>
          ),
        },
        {
          id: "charges",
          heading: "Delivery charges",
          body: (
            <>
              <p>
                Delivery is free on every order of ₹599 or more. Below that, a flat delivery fee is
                shown at checkout before you pay, so there is no surprise at the door.
              </p>
              <p>
                All prices on the site include applicable taxes. The checkout summary always confirms
                your final, all-in total.
              </p>
            </>
          ),
        },
        {
          id: "packaging",
          heading: "Packaging & cold-chain",
          body: (
            <>
              <p>
                Oils and ghee ship in glass; honey in food-grade jars; flours, millets and pulses in
                resealable kraft pouches. Chilled and perishable items travel in insulated liners so
                they arrive in the condition they left the hub.
              </p>
              <p>
                We are moving every product line to recyclable or returnable packaging. If your order
                came with liners or gel packs, hand them back to your delivery captain with your next
                order and we will reuse them.
              </p>
            </>
          ),
        },
        {
          id: "tracking",
          heading: "Tracking your order",
          body: (
            <>
              <p>
                Once your order is packed you&rsquo;ll get an SMS and email with a live link. You can
                also follow it any time from{" "}
                <a href="/orders/track">Track order</a> or under{" "}
                <a href="/orders">your orders</a>.
              </p>
              <p>
                Every box carries lot codes for the produce inside, so you can scan and trace each
                item back to the farm it came from on our{" "}
                <a href="/traceability">traceability page</a>.
              </p>
            </>
          ),
        },
        {
          id: "missed",
          heading: "Missed deliveries",
          body: (
            <p>
              If nobody is available at the address during your chosen slot, our captain will call and
              attempt a redelivery in the next available slot at no extra charge. Repeated failed
              attempts for perishable orders may be refunded under our{" "}
              <a href="/policies/refund">refund policy</a> for items that can no longer be safely
              delivered.
            </p>
          ),
        },
      ]}
    />
  );
}
