import type { Metadata } from "next";
import { PolicyLayout } from "@/components/ng/policy/policy-layout";

export const metadata: Metadata = {
  title: "Terms of service — Nutri Greenz",
  description:
    "The terms that govern your use of the Nutri Greenz storefront — accounts, orders, pricing, delivery and acceptable use.",
};

export default function TermsPage() {
  return (
    <PolicyLayout
      activeHref="/policies/terms"
      title="Terms of service"
      intro="These terms govern your use of the Nutri Greenz website and your purchases from us. By placing an order, you agree to them."
      updated="1 June 2026"
      sections={[
        {
          id: "about",
          heading: "About these terms",
          body: (
            <p>
              The Nutri Greenz storefront is operated by{" "}
              <strong>Nutrigreenz Farm Pvt. Ltd.</strong> (FSSAI 10822005000123), Hyderabad. By
              browsing the site, creating an account or placing an order, you accept these terms
              together with our <a href="/policies/privacy">privacy</a>,{" "}
              <a href="/policies/shipping">shipping</a> and{" "}
              <a href="/policies/refund">refund</a> policies.
            </p>
          ),
        },
        {
          id: "accounts",
          heading: "Your account",
          body: (
            <>
              <p>
                To shop, you sign in with your mobile number and a one-time code. You are responsible
                for keeping access to your number secure and for activity under your account.
              </p>
              <p>
                You must be 18 or older, or have the consent of a parent or guardian, to place an
                order. Please keep your contact and delivery details accurate so we can reach you.
              </p>
            </>
          ),
        },
        {
          id: "orders-pricing",
          heading: "Orders, pricing & payment",
          body: (
            <>
              <p>
                All prices are in Indian Rupees and inclusive of applicable taxes. We are a{" "}
                <strong>prepaid-first store</strong>; your order is confirmed once payment succeeds.
              </p>
              <p>
                We make every effort to display accurate prices and stock. If a genuine error or a
                stock shortage affects your order, we may decline or cancel it and refund you in full.
                A confirmed order is otherwise subject to our{" "}
                <a href="/policies/refund">no-cancellation policy</a>.
              </p>
            </>
          ),
        },
        {
          id: "delivery",
          heading: "Delivery & risk",
          body: (
            <p>
              We deliver within Hyderabad on the slots described in our{" "}
              <a href="/policies/shipping">shipping policy</a>. Risk in the goods passes to you on
              delivery to the address you provide. Please inspect your order on arrival and report any
              damaged, spoiled or incorrect items within 24 hours.
            </p>
          ),
        },
        {
          id: "loyalty-referrals",
          heading: "Loyalty & referrals",
          body: (
            <p>
              Our <a href="/loyalty">loyalty</a> and <a href="/referral">referral</a> programmes are
              offered at our discretion. Points and rewards have no cash value, are non-transferable,
              and may be adjusted or expired in line with the programme rules. We may withdraw points
              obtained through misuse or fraud.
            </p>
          ),
        },
        {
          id: "acceptable-use",
          heading: "Acceptable use",
          body: (
            <p>
              You agree not to misuse the site — including attempting to disrupt it, scrape it at
              scale, or use it for any unlawful purpose. All content, branding and imagery on the site
              belong to Nutrigreenz Farm Pvt. Ltd. and may not be reused without permission.
            </p>
          ),
        },
        {
          id: "liability-law",
          heading: "Liability & governing law",
          body: (
            <p>
              To the fullest extent permitted by law, our liability for any order is limited to the
              value of that order. Nothing in these terms limits rights you have under applicable
              consumer law. These terms are governed by the laws of India, and the courts of
              Hyderabad, Telangana have exclusive jurisdiction.
            </p>
          ),
        },
      ]}
    />
  );
}
