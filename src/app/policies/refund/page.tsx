import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Cancellation & refund policy — Nutri Greenz",
  description:
    "The cancellation and refund policy for orders placed on the Nutrigreenz Platform, operated by Nutri Greenz Farm Technologies Pvt. Ltd",
};

const REFUND_TAT: { method: string; source: string; tat: string }[] = [
  { method: "Net Banking", source: "Source", tat: "5-7 Business Days" },
  { method: "Debit / Credit Cards", source: "Source", tat: "5-7 Business Days" },
  { method: "UPI", source: "Source", tat: "2 Hours" },
  { method: "Amazon Pay (Wallet)", source: "Source", tat: "5-7 Business Days" },
  { method: "Amazon Pay (CC/DC/NB)", source: "Source", tat: "5-7 Business Days" },
  { method: "Phone Pe (Wallet)", source: "Source", tat: "5-7 Business Days" },
  { method: "Phone Pe (CC/DC/NB)", source: "Source", tat: "5-7 Business Days" },
  { method: "Wallets - Paytm / MobiKwik / Freecharge", source: "Source", tat: "2 Hours" },
  { method: "Lazy Pay", source: "Source", tat: "2 Hours" },
  { method: "Sodexo", source: "Source", tat: "5-7 Business Days" },
];

export default function RefundPolicyPage() {
  return (
    <PolicyLayout
      activeHref="/policies/refund"
      title="Cancellation & refund policy"
      intro="This policy explains when an order placed on the Nutrigreenz Platform may be cancelled, and how refunds are assessed and processed."
      updated="25 July 2026"
      sections={[
        {
          id: "introduction",
          heading: "Introduction",
          body: (
            <p>
              {
                "Any capitalized terms used but not defined herein shall have the meaning assigned to them under the Terms of Use which govern your use of our website "
              }
              <a href="https://www.nutrigreenz.farm">www.nutrigreenz.farm</a>
              {
                " (the “Website”) and our ‘Nutrigreenz’ application for mobile and handheld devices (the “App”). The Website and the App are jointly referred to as the “Platform”."
              }
            </p>
          ),
        },
        {
          id: "customer-cancellation",
          heading: "Customer cancellation",
          body: (
            <>
              <p>
                {
                  "As a general rule, Buyer shall not be entitled to cancel Order once placed. Buyer may choose to cancel Order only within one minute of the Order being placed. However, subject to Buyer’s previous cancellation history, Nutrigreenz reserves the right to deny any refund to Buyer pursuant to a cancellation initiated by Buyer even if the same is within one minute followed by suspension of account, as may be necessary in the sole discretion of Nutrigreenz."
                }
              </p>
              <p>
                {
                  "If Buyer cancels his/her Order after one minute of placing it, Nutrigreenz shall have a right to collect a penalty of 100% of the Order amount for breach of contract terms as compensation for the damages suffered by Nutrigreenz, with a right to either not to refund the Order value in case Buyer’s Order is prepaid or recover from the Buyer’s subsequent Order in case his/her Order is post-paid, to compensate the Merchants and delivery partners."
                }
              </p>
            </>
          ),
        },
        {
          id: "non-customer-cancellation",
          heading: "Non-customer cancellation",
          body: (
            <>
              <p>
                {
                  "Nutrigreenz reserves the right to collect a penalty for the Orders constrained to be cancelled by Nutrigreenz for reasons not attributable to Nutrigreenz, including but not limited to in the event if the address provided by Buyer is either wrong or falls outside the delivery zone; failure to contact Buyer by phone or email at the time of delivering the Order booking; failure to deliver Buyer Order due to lack of information, direction or authorization from Buyer at the time of delivery; or unavailability of all the items ordered by Buyer at the time of booking the Order."
                }
              </p>
              <p>
                {
                  "However, in the unlikely event of an item in an Order being unavailable, Nutrigreenz will contact the Buyer on the phone number provided to us at the time of placing the Order and inform Buyer of such unavailability. In such an event Buyer will be entitled to cancel the entire Order and shall be entitled to a refund to an amount up to 100% of the Order value."
                }
              </p>
              <p>
                {
                  "In case of cancellations for the reasons attributable to Nutrigreenz or the Merchant, Nutrigreenz shall not collect any penalty from the Buyer."
                }
              </p>
            </>
          ),
        },
        {
          id: "cancellation-conditions",
          heading: "Cancellation conditions",
          body: (
            <>
              <p>
                {
                  "Orders placed by Buyers using the Platform are non-cancellable and non-refundable except if a refund is requested under the following conditions:"
                }
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"If the Order could not be delivered within the estimated time while placing the order;"}</li>
                <li>{"If the Order has not been picked by the delivery partner;"}</li>
                <li>
                  {
                    "If the Merchant doesn’t accept or cancels the Order due to reasons not attributable to Buyer, including but not limited to non-availability of items, unable to service online orders at that moment, etc.;"
                  }
                </li>
                <li>
                  {
                    "If Nutrigreenz cancels the Order due to reasons not attributable to Buyer, including but not limited to non-availability of a delivery partner, etc."
                  }
                </li>
              </ul>
              <p>
                {
                  "Nutrigreenz reserves the right to look into the cancellation request of the Buyer and determine if such cancellation request falls under the conditions mentioned above. If Nutrigreenz is satisfied that the request fulfils any of the aforesaid conditions, then Nutrigreenz shall process the cancellation request and refund amounts to the Buyer."
                }
              </p>
            </>
          ),
        },
        {
          id: "refund",
          heading: "Refund",
          body: (
            <>
              <p>
                {
                  "Buyer may be entitled to a refund for prepaid Orders. Nutrigreenz retains the right to retain the penalty payable by the Buyer from the amount refundable to him/her. The Buyer shall also be entitled to a refund of proportionate value in the event packaging of an item in an Order, or the complete Order, is either tampered or damaged and the Buyer refuses to accept it at the time of delivery for the said reason."
                }
              </p>
              <p>
                {
                  "Buyer may be entitled to a refund up to 100% of the Order value if the delivery partner fails to deliver the Order due to a cause attributable to either the delivery partner or Nutrigreenz; however such refunds will be assessed on a case-to-case basis by Nutrigreenz. Our decision on refunds shall be final and binding."
                }
              </p>
              <p>
                {
                  "All refund amounts shall be credited to the Buyer’s account as may be stipulated per the payment mechanism of the Buyer’s choice, in case the Buyer doesn’t choose to credit it to the Buyer’s wallet with his/her Nutrigreenz Account. The estimated timelines are detailed below:"
                }
              </p>
              <div className="overflow-x-auto rounded-xl border border-ng-line-soft">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-ng-cream/60 text-left text-ng-forest-deep">
                      <th className="px-4 py-3 font-semibold">Payment method</th>
                      <th className="px-4 py-3 font-semibold">Refund source</th>
                      <th className="px-4 py-3 font-semibold">TAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REFUND_TAT.map((r) => (
                      <tr key={r.method} className="border-t border-ng-line-soft">
                        <td className="px-4 py-3">{r.method}</td>
                        <td className="px-4 py-3">{r.source}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.tat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[13.5px] text-ng-ink-soft">
                {
                  "Process: Order Edit / Cancellation / Compensation / Payment Failure. All refunds are credited to the source of payment."
                }
              </p>
            </>
          ),
        },
        {
          id: "payment-on-delivery",
          heading: "Payment at the time of delivery",
          body: (
            <>
              <p>{"In case of payment at the time of delivery, the Buyer will not be required to pay for:"}</p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"Orders where packaging is either tampered or damaged at the time of delivery."}</li>
                <li>{"Wrong Order being delivered."}</li>
                <li>{"Items missing from the Buyer’s Order at the time of delivery."}</li>
              </ul>
              <p>
                {
                  "Provided the same is communicated to Nutrigreenz Customer Care through the Platform before the Order is marked delivered."
                }
              </p>
            </>
          ),
        },
        {
          id: "specific-terms",
          heading: "Specific terms with respect to use of the Platform for purchase",
          body: (
            <>
              <p>
                <strong>{"Cancellation: "}</strong>
                {
                  "As a general rule, the Buyer shall not be entitled to cancel his/her Order once placed. If the Buyer cancels his/her Order, Nutrigreenz shall have a right to collect from the Buyer 100% of the Order amount as the cancellation fee, with a right to either not refund the Order value in case the Buyer’s Order is prepaid or recover from the Buyer’s subsequent Order(s) in case the Buyer’s Order is post-paid, to compensate the Merchants and delivery partners."
                }
              </p>
              <p>
                <strong>{"Non-customer cancellation: "}</strong>
                {
                  "Nutrigreenz reserves the right to collect the Buyer cancellation fee for Orders constrained to be cancelled by Nutrigreenz for reasons not attributable to Nutrigreenz or the Merchant, including but not limited to:"
                }
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"In the event the address provided by the Buyer is either wrong or falls outside Nutrigreenz’s delivery zone;"}</li>
                <li>{"Failure to contact the Buyer by phone or email at the time of delivering the Order;"}</li>
                <li>{"Failure to deliver the Buyer’s Order due to lack of information, direction, or authorization from the Buyer at the time of delivery;"}</li>
                <li>{"The Buyer’s failure to provide a valid OTP to the delivery partner for receiving delivery."}</li>
              </ul>
              <p>
                <strong>{"Refunds: "}</strong>
                {
                  "The Buyer may be entitled to a refund for prepaid Orders, post deduction of cancellation fee (if any), for the reasons mentioned above or in a manner as deemed fit by Nutrigreenz in its sole discretion, if refund has been requested due to the following reasons:"
                }
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"If the Order could not be delivered within the estimated delivery time;"}</li>
                <li>{"If the Merchant cancels the Order due to reasons not attributable to the Buyer, including but not limited to non-availability of items, not servicing online Orders, etc.;"}</li>
                <li>{"If Nutrigreenz cancels the Order due to reasons not attributable to the Buyer, including but not limited to non-availability of delivery partners, etc."}</li>
              </ul>
            </>
          ),
        },
        {
          id: "important-notes",
          heading: "Important notes",
          body: (
            <>
              <p>
                <strong>{"Note 1: "}</strong>
                {
                  "The Buyer shall verify his/her Order and the products before providing OTP to the delivery partner, and any issue with respect to the product or Buyer’s Order shall be notified immediately, and a cancellation request shall be placed before providing OTP to the delivery partner. Once OTP is provided to the delivery partner, it shall be deemed that the Buyer has accepted delivery of his/her Order, and once he/she has accepted delivery, the Buyer cannot cancel the Order and/or claim a refund."
                }
              </p>
              <p>
                <strong>{"Note 2: "}</strong>
                {
                  "In case of the complaint of any spurious product, the liability shall solely lie with the Merchant selling the product. Nutrigreenz is merely facilitating the transactions between the Merchant and the Buyer, and therefore Nutrigreenz shall assume no liability with respect to the products sold by the Merchant. Nutrigreenz strictly discourages dealing with any spurious product on its Platform and shall reserve the right to report such incidents to the concerned authorities for appropriate legal action."
                }
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
