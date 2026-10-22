import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms & conditions · Nutri Greenz",
  description: "The terms and conditions governing your use of the Nutrigreenz Platform, operated by Nutri Greenz Farm Technologies Pvt. Ltd",
  path: "/policies/terms",
});

export default function TermsPage() {
  return (
    <PolicyLayout
      activeHref="/policies/terms"
      title="Terms & conditions"
      intro="These terms govern your use of the Nutrigreenz website and your purchases from us. By placing an order on this site, you agree to them."
      updated="25 July 2026"
      sections={[
        {
          id: "about",
          heading: "About these terms",
          body: (
            <p>
              {"This website "}
              <a href="https://www.nutrigreenz.farm">www.nutrigreenz.farm</a>
              {
                " is operated by Nutri Greenz Farm Technologies Pvt. Ltd, an India-based company incorporated under the Indian Companies Act of 2013. The policy is issued by ‘Nutri Greenz Farm Technologies Pvt. Ltd’. By placing an order on this site, you are entering into a purchase/sale transaction with Nutri Greenz Farm Technologies Pvt. Ltd. The terms and conditions are set out below."
              }
            </p>
          ),
        },
        {
          id: "definitions",
          heading: "Definitions",
          body: (
            <>
              <p>
                {
                  "“Agreement” means the terms and conditions as detailed herein including all schedules, appendices, annexure, privacy policy and will include the references to this Agreement as amended, supplemented, varied, or replaced from time to time."
                }
              </p>
              <p>
                {
                  "The “Site” means the online shopping portal owned and operated by Nutri Greenz Farm Technologies Pvt. Ltd which provides a platform to the shoppers to buy the products listed on the site. “Vendor” / “Seller” / “Affiliate” shall mean the person or any legal entity who offers for sale, or sells the products or services on "
                }
                <a href="https://www.nutrigreenz.farm">www.nutrigreenz.farm</a>
                {"."}
              </p>
              <p>
                {
                  "“Customer” / “Buyer” shall mean the person or any legal entity who accepts the offer for sale on the site by placing an order for and/or purchases any products offered for sale on the site. “User” / “You” means and includes you and/or any person or an entity including Vendor/Seller/Affiliate using or accessing the services provided on this Site."
                }
              </p>
            </>
          ),
        },
        {
          id: "eligibility",
          heading: "Eligibility",
          body: (
            <p>
              {
                "You represent and warrant that you are competent and eligible to enter into a legally binding agreement and have the requisite authority to bind the other party to this Agreement. You shall not use this Site if you are not competent to contract under the applicable laws, rules, and regulations."
              }
            </p>
          ),
        },
        {
          id: "term",
          heading: "Term",
          body: (
            <p>
              {
                "This Agreement shall continue in full force and effect for as long as you use the site. The site provides an online shopping platform on which Users can buy the products and services listed on it under the terms and conditions set out below. By clicking on the “Proceed to Payment” button, you are agreeing to use the Services in a manner consistent with and to abide by the terms and conditions of this Agreement, our Privacy Policy, and all applicable laws and regulations."
              }
            </p>
          ),
        },
        {
          id: "termination",
          heading: "Termination",
          body: (
            <p>
              {
                "Either User/You or Nutri Greenz Farm Technologies Pvt. Ltd may terminate the agreement at any time, with or without cause. However, Nutri Greenz Farm Technologies Pvt. Ltd reserves the right, in its sole discretion, to terminate your access to the products and services offered on the site or any portion thereof at any time, without notice."
              }
            </p>
          ),
        },
        {
          id: "modification",
          heading: "Modification of terms and conditions",
          body: (
            <p>
              {
                "Nutri Greenz Farm Technologies Pvt. Ltd may at any time modify the terms and conditions contained on the Site without any prior notification to you. You can access the latest version of the Terms and Conditions at any time. You should review the Terms and Conditions regularly. If the modified Terms and Conditions are not acceptable to you, you should stop using the site. If you continue to use the site, you agree to accept and abide by the modified Terms and Conditions."
              }
            </p>
          ),
        },
        {
          id: "online-shopping-platform",
          heading: "Online shopping platform",
          body: (
            <>
              <p>
                {
                  "You further agree and undertake that you are accessing the services available on this Site and transacting at your sole risk and are using your best and prudent judgment before entering into any transaction through this Site."
                }
              </p>
              <p>
                {
                  "Nutri Greenz Farm Technologies Pvt. Ltd accepts no liability for any errors or omissions, whether on behalf of itself or third parties. The delivery address for the products you order should be correct and proper in all respects."
                }
              </p>
              <p>
                {
                  "After the receipt of payment by the Buyer, or on cash on delivery as the case may be, Nutri Greenz Farm Technologies Pvt. Ltd shall arrange for the delivery of the product to the recipient at the shipping address provided by the Buyer. All orders you place on this site are a firm commitment to purchase, and you are obligated to complete the transaction and not contest it in any way. Please check the product description carefully before placing an order. By placing an order for a product, you agree to be bound by the conditions of sale included in the item’s description."
                }
              </p>
            </>
          ),
        },
        {
          id: "product-pricing",
          heading: "Product pricing",
          body: (
            <p>
              {
                "Product prices listed on the website are current. While every care has been taken to label the products accurately, errors in data entry and updating may occur. Nutri Greenz Farm Technologies Pvt. Ltd reserves the right to cancel the order in case a wallet (excluding any cashback benefit) is refundable by placing the request to customer support. The refundable amount is credited to the customer’s bank account shared using the link sent by SMS by Nutri Greenz Farm Technologies Pvt. Ltd. Refund is credited within 5 to 7 working days of sharing the bank details. If payment was made by credit card, it will be refunded to the same mode of payment."
              }
            </p>
          ),
        },
        {
          id: "offer-cashback",
          heading: "Offer & cashback",
          body: (
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>{"Maximum cashback up to Rs 150."}</li>
              <li>{"Cannot be clubbed with any other offer."}</li>
              <li>{"Maximum of 1 offer per address."}</li>
              <li>{"Offer valid on first recharge only."}</li>
              <li>{"Cashback amount cannot be refunded."}</li>
            </ul>
          ),
        },
        {
          id: "cancellation-policy",
          heading: "Cancellation policy",
          body: (
            <>
              <p>
                {
                  "Customers can cancel or stop their subscription in the Nutrigreenz mobile application or by contacting customer support."
                }
              </p>
              <p>
                {
                  "Multiple accounts cannot be created with the same address. If such accounts are found, Nutri Greenz Farm Technologies Pvt. Ltd has the right to cancel or stop the Customer’s subscription."
                }
              </p>
            </>
          ),
        },
        {
          id: "entire-agreement",
          heading: "Entire agreement",
          body: (
            <p>
              {
                "These Terms and Conditions, together with the privacy policy, and other rules and policies posted on the site, which are hereby incorporated as set forth fully in these Terms and Conditions, constitute the entire agreement between you and Nutri Greenz Farm Technologies Pvt. Ltd with respect to your use of and material available through the site, and supersede all prior or contemporaneous communications and proposals between you and Nutri Greenz Farm Technologies Pvt. Ltd with respect to this site. Any rights not expressly granted in these Terms and Conditions are reserved."
              }
            </p>
          ),
        },
        {
          id: "communication",
          heading: "Communication",
          body: (
            <p>
              {
                "By registering with Nutri Greenz Farm Technologies Pvt. Ltd, you give us permission to send you notifications on WhatsApp, SMS and email."
              }
            </p>
          ),
        },
        {
          id: "billing-payment",
          heading: "Billing policy & payment",
          body: (
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>{"The billing cycle for customers is 15 days, which means bills are generated twice a month."}</li>
              <li>{"If you pay a bill by cheque, please draw the cheque in favour of ‘NUTRIGREENZ FARM TECHNOLOGIES PVT LTD’."}</li>
              <li>{"If you pay a bill in cash, please submit the OTP sent to your registered mobile number before handing over the cash to our delivery partner."}</li>
              <li>{"Customers are liable to receive the transaction details for the latest 6 months only. Nutrigreenz will not provide customer transaction details beyond 6 months."}</li>
              <li>{"Customers can download the latest 3 months’ bills through the Nutrigreenz application."}</li>
            </ul>
          ),
        },
        {
          id: "return-policy",
          heading: "Return policy",
          body: (
            <p>
              {
                "The return policy has been revised. Under the revised policy, Nutri Greenz Farm Technologies Pvt. Ltd does not accept returns unless the return is related to product quality. If a customer wants to return a product because he/she doesn’t need it, we will deny the return."
              }
            </p>
          ),
        },
        {
          id: "referral-program",
          heading: "Referral program",
          body: (
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>{"One user can refer a maximum of 15 new users. The Referee and the Referrer cannot have the same address."}</li>
              <li>{"The Referrer should have placed at least one order with Nutri Greenz Farm Technologies Pvt. Ltd in the last thirty (30) days of minimum value of Rs.100 or more in their lifetime."}</li>
              <li>{"To be considered a successful Referral, the person you refer (the Referee) must place at least one order with a minimum value of Rs.100."}</li>
              <li>{"The Referrer gets 100% cashback up to a maximum of Rs.100 per Referee, on the Referee’s first order of minimum amount Rs.100. Nutrigreenz reserves the right to revise the maximum cashback percentage and amount at any point during this referral programme."}</li>
              <li>{"Referral bonus cannot be clubbed with any other promotional offer or bonus."}</li>
              <li>{"‘Bonus’ amount can be used only for purchases on the Nutrigreenz website and/or mobile application, is not transferable, and in no case can be used as an exchange for tender of money."}</li>
              <li>{"Nutrigreenz reserves the right to modify or amend these Terms and Conditions at any time, and to disqualify any Referrer from participation at any time at its sole discretion, including if he/she does not comply with any of these Terms and Conditions."}</li>
              <li>{"The Referrer and the Referee agree to indemnify, release and hold harmless Nutri Greenz Farm Technologies Pvt. Ltd from any and all claims, actions, demands, damages, losses, liabilities, costs or expenses arising out of or related to the Referrer’s participation in the referral program. No person under 18 years of age may use, access or participate in the referral program."}</li>
              <li>{"Nutrigreenz shall not be liable for late, delayed, stolen, misdirected, or inaccurate credits in relation to any information provided by the Referee or Referrer, and reserves the right to hold back or debit the cashback bonus in case of violation of these terms."}</li>
              <li>{"Any and all disputes, claims and causes of action arising out of or related to the referral program shall be resolved under applicable Indian law."}</li>
            </ul>
          ),
        },
        {
          id: "nach-mandate",
          heading: "NACH mandate and transaction management",
          body: (
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>{"Transactions against the NACH Mandate shall be processed only on a Business Day. Any Transaction due on a non-Business Day will be processed on the next Business Day. If such a Transaction fails, it shall not be retried for that calendar month."}</li>
              <li>{"The Customer shall not be permitted to modify any existing NACH Mandate, as the Bank does not currently support any modification flow. However, the Customer can revoke the NACH Mandate at least two days before the next Due Date and set up a new mandate."}</li>
              <li>{"The processing of the NACH Mandate is subject to the actions of the Destination Bank and clearance of funds by the Destination Bank."}</li>
              <li>{"If the NACH Mandate is revoked at the Customer’s request, the Customer shall be required to restart the entire process of setting up a NACH Mandate if the Customer wants one."}</li>
              <li>{"Nutrigreenz shall process the NACH Mandate only on the basis of the Destination Account details provided by the Customer and verified via mandate verification by the Destination Bank, and shall not be responsible in any manner to verify the details of the Destination Account."}</li>
            </ul>
          ),
        },
        {
          id: "limitation-liability",
          heading: "Limitation of liability",
          body: (
            <>
              <p>
                {
                  "Nutri Greenz Farm Technologies Pvt. Ltd assumes no responsibility and shall incur no liability if it is unable to effect the Transaction against the NACH Mandate owing to any one or more of the following circumstances:"
                }
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>{"If the NACH Mandate issued by the Customer is incomplete, inaccurate, invalid, or incorrect."}</li>
                <li>{"If the Destination Account has insufficient balance to enable us to debit it to the extent of the NACH Mandate."}</li>
                <li>{"If the funds available in the Destination Account are under any encumbrance or charge or subject to the Destination Bank’s right of banker’s lien."}</li>
                <li>{"If the Destination Account is under any attachment or debit freeze on account of any legal and/or regulatory directions."}</li>
              </ul>
            </>
          ),
        },
        {
          id: "prepaid-products",
          heading: "Pre-paid products",
          body: (
            <p>
              {
                "To have the products delivered to your doorstep, you are required to pay the MRP of the selected product at the time of placing an order, using any of the available payment modes."
              }
            </p>
          ),
        },
        {
          id: "communication-policy",
          heading: "Communication policy",
          body: (
            <p>
              {
                "By signing up with Nutri Greenz Farm Technologies Pvt. Ltd, the customer agrees to receive communication by WhatsApp, push notification, SMS, email, customer support call, the App and the Website as per the Site Agreement."
              }
            </p>
          ),
        },
        {
          id: "disclaimer",
          heading: "Disclaimer",
          body: (
            <p>
              {
                "The company does not solicit any investment opportunity or promise of returns through investment schemes. Such schemes may reach you through fake websites or apps that are deceptively similar to the company’s website and logo. These claims and offers are fraudulent and invalid. You are strongly advised to exercise great caution and disregard such offers and invitations."
              }
            </p>
          ),
        },
      ]}
    />
  );
}
